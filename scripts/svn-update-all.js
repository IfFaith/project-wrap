const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * 遍历 `packages` 目录下的所有子项目，执行 `svn update`，并返回冲突文件列表和有变动的 package.json 文件列表。
 * @returns {{conflictFiles: string[], changedPackages: string[]}}
 */
function runUpdateAndCheckStatus() {
  const CWD = process.cwd()
  const packagesDir = path.join(CWD, 'packages')

  if (!fs.existsSync(packagesDir) || !fs.lstatSync(packagesDir).isDirectory()) {
    console.warn(
      `警告: 'packages' 目录未找到或不是一个目录，路径: ${packagesDir}。跳过 SVN 更新。`
    )
    return { conflictFiles: [], changedPackages: [] }
  }

  const subProjects = fs.readdirSync(packagesDir)
  const conflictFiles = []
  const changedPackages = []
  const beforePackageJson = {}

  // 1. 记录每个项目svn update前的package.json内容
  for (const project of subProjects) {
    const projectPath = path.join(packagesDir, project)
    if (fs.lstatSync(projectPath).isDirectory()) {
      const pkgJsonPath = path.join(projectPath, 'package.json')
      if (fs.existsSync(pkgJsonPath)) {
        beforePackageJson[project] = fs.readFileSync(pkgJsonPath, 'utf-8')
      }
    }
  }

  // 2. 执行svn revert和svn update并检测冲突
  for (const project of subProjects) {
    const projectPath = path.join(packagesDir, project)
    if (fs.lstatSync(projectPath).isDirectory()) {
      // 新增：先还原本地所有修改
      try {
        console.log(`\n正在为 ${project} 执行 svn revert -R . ...`)
        const revertOutput = execSync('svn revert -R .', {
          cwd: projectPath,
          encoding: 'utf-8',
        })
        if (revertOutput) {
          console.log(revertOutput)
        }
      } catch (revertError) {
        console.error(`${project} svn revert 失败: ${revertError.message}`)
      }
      // 之后再执行svn update
      console.log(`\n正在为 ${project} 执行 svn update...`)
      try {
        const output = execSync('svn update', {
          cwd: projectPath,
          encoding: 'utf-8',
        })
        console.log(output)
        // 检查输出中是否有冲突标记
        const lines = output.split('\n')
        lines.forEach((line) => {
          if (line.startsWith('C    ')) {
            const conflictPath = line.replace('C    ', '').trim()
            conflictFiles.push(path.join(projectPath, conflictPath))
          }
        })
      } catch (error) {
        console.error(`${project} svn update 失败: ${error.message}`)
        // 即使命令失败，也要检查输出中是否包含冲突信息
        if (error.stdout) {
          const lines = error.stdout.split('\n')
          lines.forEach((line) => {
            if (line.startsWith('C    ')) {
              const conflictPath = line.replace('C    ', '').trim()
              conflictFiles.push(path.join(projectPath, conflictPath))
            }
          })
        }
      }
    }
  }

  // 3. 对比svn update前后的package.json内容
  for (const project of subProjects) {
    const projectPath = path.join(packagesDir, project)
    if (fs.lstatSync(projectPath).isDirectory()) {
      const pkgJsonPath = path.join(projectPath, 'package.json')
      if (
        fs.existsSync(pkgJsonPath) &&
        beforePackageJson[project] !== undefined
      ) {
        const afterContent = fs.readFileSync(pkgJsonPath, 'utf-8')
        if (beforePackageJson[project] !== afterContent) {
          changedPackages.push(pkgJsonPath)
        }
      }
    }
  }

  return { conflictFiles, changedPackages }
}

// 当此文件被直接执行时（例如通过 `node scripts/svn-update-all.js`），运行以下逻辑
// `require.main === module` 能判断出当前文件是否是主入口文件
if (require.main === module) {
  const { conflictFiles, changedPackages } = runUpdateAndCheckStatus()

  if (conflictFiles.length > 0) {
    console.log('\n\x1b[31m错误: 发现 SVN 冲突文件:\x1b[0m')
    conflictFiles.forEach((file) => console.log(`- ${file}`))
    console.log('\n请先手动解决冲突后再试。')
    process.exit(1) // 以非零错误码退出，表示执行失败
  } else {
    console.log('\n\x1b[32m成功: 所有项目 SVN 更新完毕，无冲突。\x1b[0m')
  }

  if (changedPackages.length > 0) {
    console.log('\n\x1b[33m警告: 以下 package.json 文件发生了变更:\x1b[0m')
    changedPackages.forEach((file) => console.log(`- ${file}`))
    console.log('\n建议运行 "npm run installAll" 来同步依赖。')
  } else {
    console.log(
      '\n\x1b[32m信息: SVN 更新后所有 package.json 文件均无变化。\x1b[0m'
    )
  }
}

// 导出核心函数，以便其他脚本可以 `require` 和使用
module.exports = { runUpdateAndCheckStatus }
