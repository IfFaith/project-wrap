const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CWD = process.cwd();
const packagesDir = path.join(CWD, 'packages');

// 遍历packages下所有子项目
const subProjects = fs.readdirSync(packagesDir);
for (const project of subProjects) {
  const projectPath = path.join(packagesDir, project);
  if (fs.lstatSync(projectPath).isDirectory()) {
    console.log(`正在为 ${project} 执行 npm i --force...`);
    try {
      execSync('npm i --force', { cwd: projectPath, stdio: 'inherit' });
      console.log(`${project} 的依赖安装完成`);
    } catch (error) {
      console.error(`${project} 的依赖安装失败: ${error.message}`);
    }
  }
}

console.log('所有项目的依赖安装任务已完成'); 