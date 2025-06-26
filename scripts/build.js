const execa = require('execa')
const ora = require('ora')
const { resolve } = require('path')
const fs = require('fs')
const path = require('path')
const inquirer = require('inquirer')

const CWD = process.cwd()
const packagesDir = resolve(CWD, './packages')
const ihiveLibDir = fs
  .readdirSync(packagesDir)
  .find((name) => name.includes('ihive-lib'))
const PKG_MALL_COOK_TEMPLATE = resolve(packagesDir, ihiveLibDir)
const PKG_MALL_COOK_PLATFORMS = fs
  .readdirSync(packagesDir)
  .filter((name) => !name.includes('ihive-lib'))
  .map((name) => resolve(packagesDir, name))

// 检查并等待ngcc进程完成
async function waitForNgcc() {
  const s = ora().start('检查ngcc进程状态...')
  try {
    // 等待一段时间，确保ngcc进程完成
    await new Promise(resolve => setTimeout(resolve, 5000))
    s.succeed('ngcc进程检查完成')
  } catch (e) {
    s.fail('ngcc进程检查失败')
    console.error(`失败原因：${e.toString()}`)
  }
}

const buildTemplate = () =>
  execa('npm run', ['build-all'], { cwd: PKG_MALL_COOK_TEMPLATE, stdio: 'inherit' })

async function runTask(taskName, task) {
  const s = ora().start(`${taskName} 开始打包 `)
  try {
    const result = await task()
    if (result && result.stdout) {
      console.log(result.stdout)
    }
    s.succeed(`${taskName} 打包完成!`)
  } catch (e) {
    s.fail(`${taskName} 打包失败!`)
    console.error(`失败原因：${e.toString()}`)
  }
}

// 删除ihive的函数，接收平台包路径参数
async function deleteIhiveForPlatform(platformPath) {
  const toDeleteTargetDirectory = path.join(platformPath, 'node_modules')
  const folderName = '@ihive'
  const folderPath = path.join(toDeleteTargetDirectory, folderName)
  const copyPath = path.join(PKG_MALL_COOK_TEMPLATE, 'dist', '@ihive')
  try {
    if (fs.existsSync(folderPath)) {
      fs.rmdirSync(folderPath, { recursive: true })
      console.log(`删除成功：${folderPath}`)
      copyFolderRecursive(copyPath, folderPath)
    } else {
      copyFolderRecursive(copyPath, folderPath)
      console.log(`${folderPath} 不存在`)
    }
  } catch (err) {
    console.error(`删除失败：${err}`)
  }
}

function copyFolderRecursive(source, target) {
  // 检查目标文件夹是否存在，如果不存在则创建
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true })
  }

  // 读取源文件夹内容
  const items = fs.readdirSync(source)

  for (const item of items) {
    const sourcePath = path.join(source, item)
    const targetPath = path.join(target, item)

    // 判断是文件还是文件夹
    if (fs.lstatSync(sourcePath).isDirectory()) {
      // 如果是文件夹，递归复制
      copyFolderRecursive(sourcePath, targetPath)
    } else {
      // 如果是文件，直接复制
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

;(async () => {
  // 首先等待ngcc进程完成
  await waitForNgcc()

  // 列出所有非ihive-lib的包，供用户选择
  const { selectedPlatforms } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedPlatforms',
      message: '请选择需要打包的平台包:',
      choices: PKG_MALL_COOK_PLATFORMS.map(platformPath => path.basename(platformPath))
    }
  ])

  // 根据用户选择，过滤出需要处理的平台包路径
  const selectedPlatformPaths = PKG_MALL_COOK_PLATFORMS.filter(platformPath => 
    selectedPlatforms.includes(path.basename(platformPath))
  )

  await runTask('ihive-lib', buildTemplate)
  await Promise.all(
    selectedPlatformPaths.map(platformPath => deleteIhiveForPlatform(platformPath))
  )
  await Promise.all(
    selectedPlatformPaths.map(platformPath => {
      const platformName = path.basename(platformPath)
      const buildPlatform = () => execa('npm run', ['build-all'], { cwd: platformPath, stdio: 'inherit' })
      return runTask(platformName, buildPlatform)
    })
  )

})()
