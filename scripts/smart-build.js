const execa = require('execa')
const ora = require('ora')
const inquirer = require('inquirer')
const fs = require('fs')
const path = require('path')
const { runUpdateAndCheckStatus } = require('./svn-update-all.js')

/**
 * 带有加载动画效果的执行 npm script 命令
 * @param {string} script - 要执行的 npm script 名称 (例如 'build')
 * @param {string[]} args - 传递给命令的额外参数
 * @returns {Promise<void>}
 */
async function runNpmScript(script, args = [], params = {}) {
  const command = `npm run ${script}${
    args.length > 0 ? ' ' + args.join(' ') : ''
  }`
  let spinner
  if (script !== 'build') {
    spinner = ora(`正在执行 '${command}'...`).start()
  }
  try {
    // 使用 execa 执行命令，'npm' 是命令，['run', script, ...args] 是参数
    await execa('npm', ['run', script, ...args], params)
    spinner && spinner.succeed(`'${command}' 执行成功。`)
  } catch (error) {
    spinner && spinner.fail(`'${command}' 执行失败。`)
    // 打印错误详情
    console.error(error.stderr || error.stdout || error.message)
    // 抛出错误，中断后续流程
    throw error
  }
}

/**
 * 主函数，编排整个智能构建流程
 */
async function main() {
  // 记录开始时间
  const startTime = new Date()
  function formatTime(date) {
    return (
      date.getFullYear() +
      '-' +
      String(date.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getDate()).padStart(2, '0') +
      ' ' +
      String(date.getHours()).padStart(2, '0') +
      ':' +
      String(date.getMinutes()).padStart(2, '0') +
      ':' +
      String(date.getSeconds()).padStart(2, '0')
    )
  }

  // --- 新增：获取可选平台并让用户选择 ---
  const CWD = process.cwd()
  const packagesDir = path.resolve(CWD, './packages')
  const availablePlatforms = fs.readdirSync(packagesDir).filter((name) => {
    const fullPath = path.join(packagesDir, name)
    // 排除 ihive-lib 并确保是目录
    return !name.includes('ihive-lib') && fs.lstatSync(fullPath).isDirectory()
  })

  if (availablePlatforms.length === 0) {
    console.log('❌ 在 "packages" 目录下未找到任何可构建的平台项目。')
    return
  }

  const { selectedPlatforms } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedPlatforms',
      message:
        '请选择你希望通过智能构建流程打包的项目：(按<space>下可选择、<a>切换全部、<i>反转选择，<enter>进行)',
      choices: availablePlatforms,
      validate: function (answer) {
        if (answer.length < 1) {
          return '你必须至少选择一个项目。'
        }
        return true
      },
    },
  ])
  // --- 用户选择结束 ---

  console.log('\n🚀 开始执行智能构建流程...')

  // 1. 更新 SVN 并检查状态
  // 注意：runUpdateAndCheckStatus 是同步的，它会阻塞在这里直到 SVN 操作完成
  const { conflictFiles, changedPackages } = runUpdateAndCheckStatus(selectedPlatforms)

  if (conflictFiles.length > 0) {
    // SVN 冲突日志已在 runUpdateAndCheckStatus 中打印，这里只做总结和退出
    console.error('\n🛑 流程已中止。请先手动解决以上冲突，然后重新运行脚本。')
    process.exit(1)
  }

  try {
    // 2. 根据 package.json 变动情况决定执行流程
    if (changedPackages.length > 0) {
      console.log(
        '\n✨ 检测到 package.json 文件发生变化，将执行完整流程: install -> build -> copy'
      )

      await runNpmScript('installAll')
      await runNpmScript('build', ['--', ...selectedPlatforms], {
        stdio: 'inherit',
      })
      await runNpmScript('copy')
    } else {
      console.log('\n✨ package.json 文件无变化，将执行标准流程: build -> copy')
      await runNpmScript('build', ['--', ...selectedPlatforms], {
        stdio: 'inherit',
      })
      await runNpmScript('copy')
    }

    console.log('\n✅ \x1b[32m智能构建流程全部执行成功！\x1b[0m')
    // 记录结束时间并输出
    const endTime = new Date()
    console.log(`\n🕒 打包开始时间：${formatTime(startTime)}`)
    console.log(`\n🕒 打包结束时间：${formatTime(endTime)}`)
  } catch (error) {
    console.error('\n❌ \x1b[31m智能构建流程因错误中断。\x1b[0m')
    process.exit(1)
  }
}

main()
