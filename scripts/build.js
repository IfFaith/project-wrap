const execa = require('execa')
const ora = require('ora')
const { resolve } = require('path')
const fs = require('fs')
const path = require('path')
const inquirer = require('inquirer')
const { execSync } = require('child_process')

const CWD = process.cwd()
const packagesDir = resolve(CWD, './packages')
const ihiveLibDir = fs
  .readdirSync(packagesDir)
  .find((name) => name.includes('ihive-lib'))
const PKG_MALL_COOK_TEMPLATE = resolve(packagesDir, ihiveLibDir)
const PKG_MALL_COOK_PLATFORMS = fs
  .readdirSync(packagesDir)
  .filter((name) => {
    const fullPath = path.join(packagesDir, name)
    return !name.includes('ihive-lib') && fs.lstatSync(fullPath).isDirectory()
  })
  .map((name) => resolve(packagesDir, name))

// 检查ngcc进程是否存在
function isNgccRunning() {
  try {
    let result;
    if (process.platform === 'win32') {
      // Windows
      result = execSync('tasklist', { encoding: 'utf-8' });
      return result.toLowerCase().includes('ngcc');
    } else {
      // Linux/Mac
      result = execSync('ps aux', { encoding: 'utf-8' });
      return result.includes('ngcc');
    }
  } catch (e) {
    return false;
  }
}

// 检查并等待ngcc进程完成
async function waitForNgcc() {
  const s = ora().start('检查ngcc进程状态...')
  try {
    let retry = 0;
    while (isNgccRunning()) {
      if (retry > 60) { // 最多等60次（约1分钟）
        s.fail('ngcc进程长时间未结束，可能卡住了');
        throw new Error('ngcc进程长时间未结束');
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retry++;
    }
    s.succeed('ngcc进程检查完成');
  } catch (e) {
    s.fail('ngcc进程检查失败');
    console.error(`失败原因：${e.toString()}`);
  }
}

const buildTemplate = () =>
  execa('npm run', ['build-all'], {
    cwd: PKG_MALL_COOK_TEMPLATE,
    stdio: 'inherit',
  })

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
  // 获取命令行参数 (去除 'node' 和脚本路径)
  const args = process.argv.slice(2);
  const buildAll = args.includes('--all');
  // 过滤出所有非标志位的参数，作为要打包的平台名称
  const platformsFromArgs = args.filter(arg => !arg.startsWith('--'));

  let selectedPlatformPaths;

  if (platformsFromArgs.length > 0) {
    console.log(`接收到参数，将打包指定的平台: ${platformsFromArgs.join(', ')}`);
    selectedPlatformPaths = PKG_MALL_COOK_PLATFORMS.filter(platformPath =>
      platformsFromArgs.includes(path.basename(platformPath))
    );
  } else if (buildAll) {
    console.log('检测到 --all 参数，将自动打包所有平台。');
    selectedPlatformPaths = PKG_MALL_COOK_PLATFORMS;
  } else {
    // 如果没有通过参数指定平台，则弹出交互式选择框
    const { selectedPlatforms } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedPlatforms',
        message: '请选择需要打包的平台包:',
        choices: PKG_MALL_COOK_PLATFORMS.map((platformPath) =>
          path.basename(platformPath)
        ),
        validate: function (answer) {
          if (answer.length < 1) {
            return '你必须至少选择一个平台进行打包。';
          }
          return true;
        },
      },
    ])
    // 根据用户选择，过滤出需要处理的平台包路径
    selectedPlatformPaths = PKG_MALL_COOK_PLATFORMS.filter((platformPath) =>
      selectedPlatforms.includes(path.basename(platformPath))
    )
  }

  // 如果没有选择任何平台（或者没有平台可选），则直接退出
  if (selectedPlatformPaths.length === 0) {
    console.log('没有选择任何平台进行打包，程序将退出。')
    return
  }

  await waitForNgcc() // 打包ihive-lib前也检测一次
  await runTask('ihive-lib', buildTemplate)
  await Promise.all(
    selectedPlatformPaths.map((platformPath) => deleteIhiveForPlatform(platformPath))
  )

  // 依次对每个平台打包前都检测ngcc
  for (const platformPath of selectedPlatformPaths) {
    const platformName = path.basename(platformPath)
    await waitForNgcc()
    const buildPlatform = () =>
      execa('npm run', ['build-all'], { cwd: platformPath, stdio: 'inherit' })
    await runTask(platformName, buildPlatform)
  }
})()
