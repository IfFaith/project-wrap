const { execSync } = require('child_process')
const ora = require('ora')
const fs = require('fs')
const path = require('path')

// 服务器配置 - 请根据实际情况修改
const SERVER_CONFIG = {
  host: '', //服务器地址
  user: '', //用户名
  port: 22, //scp链接的端口
  remotePath: '', // 放在哪个文件夹下
}

/**
 * 使用 scp 上传 dist 目录下的所有内容到服务器
 * @param {Object} config 服务器配置
 * @param {string} localDistPath 本地 dist 目录路径
 */
function deployToServer(config = SERVER_CONFIG, localDistPath = './dist') {
  const spinner = ora('正在部署到服务器...').start()

  try {
    // 检查 dist 目录是否存在
    if (!fs.existsSync(localDistPath)) {
      throw new Error('dist 目录不存在，请先执行构建命令')
    }

    // 检查 dist 目录是否为空
    const distContents = fs.readdirSync(localDistPath)
    if (distContents.length === 0) {
      throw new Error('dist 目录为空，请先执行构建命令')
    }

    spinner.text = '正在通过 scp 上传文件到服务器...'
    // 使用 scp 上传 dist 目录下的所有内容
    // -P 指定端口，-r 递归目录
    const uploadCommand = `scp -P ${config.port} -r ${localDistPath}/* ${config.user}@${config.host}:${config.remotePath}`
    execSync(uploadCommand, { stdio: 'inherit' })

    spinner.succeed('部署成功！')
    console.log(
      `\n✅ 文件已成功上传到服务器：${config.host}:${config.remotePath}`
    )
  } catch (error) {
    spinner.fail('部署失败！')
    console.error('\n❌ 错误详情：', error.message)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  deployToServer()
}

module.exports = { deployToServer }
