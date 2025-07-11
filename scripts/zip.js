const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const { resolve } = require('path')
const ora = require('ora')
const chalk = require('chalk') // 用于彩色输出
const inquirer = require('inquirer')

/**
 * 将多个文件夹压缩为一个ZIP文件（带状态显示）
 * @param {Array<string>} folders 要压缩的文件夹路径数组
 * @param {string} outputPath 输出的ZIP文件路径
 * @returns {Promise<void>}
 */
async function zipMultipleFoldersWithProgress(folders, outputPath) {
  // 初始化状态指示器
  const mainSpinner = ora({
    text: chalk.blue('正在初始化压缩任务...'),
    color: 'blue',
  }).start()

  // 创建输出文件流
  const output = fs.createWriteStream(outputPath)

  // 创建archiver实例
  const archive = archiver('zip', {
    zlib: { level: 9 },
  })

  // 状态变量
  let totalFiles = 0
  let processedFiles = 0
  let startTime = Date.now()

  return new Promise((resolve, reject) => {
    // 监听文件添加事件（用于计数）
    archive.on('entry', (entry) => {
      if (entry.stats.isFile()) {
        totalFiles++
      }
    })

    // 监听处理进度
    archive.on('progress', (progress) => {
      processedFiles = progress.entries.processed
      const percent = Math.round((processedFiles / totalFiles) * 100)
      mainSpinner.text = chalk.yellow(
        `压缩中: ${processedFiles}/${totalFiles} 文件 (${percent}%) | ` +
          `已压缩: ${formatBytes(progress.fs.processedBytes)}`
      )
    })

    // 监听完成事件
    output.on('close', () => {
      const endTime = Date.now()
      const duration = ((endTime - startTime) / 1000).toFixed(2)
      mainSpinner.succeed(
        chalk.green(
          `压缩完成! 耗时: ${duration}s | ` +
            `总大小: ${formatBytes(archive.pointer())} | ` +
            `文件数: ${totalFiles}`
        )
      )
      resolve()
    })

    // 错误处理
    archive.on('error', (err) => {
      mainSpinner.fail(chalk.red('压缩失败'))
      reject(err)
    })

    // 管道连接输出流
    archive.pipe(output)

    // 添加每个文件夹到压缩包
    folders.forEach((folder) => {
      const folderName = path.basename(folder)
      const folderSpinner = ora({
        text: chalk.cyan(`正在添加目录: ${folderName}`),
        color: 'cyan',
      }).start()

      if (!fs.existsSync(folder)) {
        folderSpinner.fail(chalk.red(`目录不存在: ${folderName}`))
        return
      }

      // 添加整个文件夹
      archive.directory(folder, folderName)
      folderSpinner.succeed(chalk.green(`已添加目录: ${folderName}`))
    })

    // 完成初始化
    mainSpinner.text = chalk.blue('开始压缩文件...')
    startTime = Date.now()

    // 开始压缩
    archive.finalize()
  })
}

// 辅助函数：格式化字节大小
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function getFolder() {
  const CWD = process.cwd()
  const packagesDir = path.resolve(CWD, './dist')
  const availablePlatforms = fs.readdirSync(packagesDir).filter((name) => {
    const fullPath = path.join(packagesDir, name)
    // 排除 ihive-lib 并确保是目录
    return name !== '@ihive' && fs.lstatSync(fullPath).isDirectory()
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
  const folders = selectedPlatforms.map((folder) =>
    resolve(packagesDir, folder)
  )
  return folders
}

// 使用示例
;(async () => {
  const PKG_MALL_COOK_PLATFORMS = await getFolder()
  try {
    console.log(chalk.bold.cyan('\n压缩目录:'))
    PKG_MALL_COOK_PLATFORMS.forEach((dir) => {
      console.log(`- ${path.basename(dir)}`)
    })
    await zipMultipleFoldersWithProgress(
      PKG_MALL_COOK_PLATFORMS,
      './dist/package.zip'
    )
  } catch (err) {
    console.error(chalk.bold.red('\n压缩失败:'), err)
    process.exit(1)
  }
})()
