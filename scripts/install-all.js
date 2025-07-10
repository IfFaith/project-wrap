const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const CWD = process.cwd()
const packagesDir = path.join(CWD, 'packages')

// 获取命令行参数（去除 node 和脚本路径）
const args = process.argv.slice(2)

// 如果有参数，只为这些 package.json 所在项目安装依赖
let projectsToInstall = []

if (args.length > 0) {
  // 参数为 package.json 路径
  projectsToInstall = args
    .map(pkgPath => {
      // 兼容绝对路径和相对路径
      const absPath = path.isAbsolute(pkgPath) ? pkgPath : path.join(CWD, pkgPath)
      // 获取项目目录
      return path.dirname(absPath)
    })
    // 去重
    .filter((value, index, self) => self.indexOf(value) === index)
} else {
  // 没有参数，默认全量
  projectsToInstall = fs.readdirSync(packagesDir)
    .map(project => path.join(packagesDir, project))
    .filter(projectPath => fs.lstatSync(projectPath).isDirectory())
}

for (const projectPath of projectsToInstall) {
  const project = path.basename(projectPath)
  console.log(`正在为 ${project} 执行 npm i --force...`)
  try {
    execSync('npm i --force', { cwd: projectPath, stdio: 'inherit' })
    console.log(`${project} 的依赖安装完成`)
  } catch (error) {
    console.error(`${project} 的依赖安装失败: ${error.message}`)
  }
}

console.log('依赖安装任务已完成')
