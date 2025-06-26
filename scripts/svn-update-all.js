const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CWD = process.cwd();
const packagesDir = path.join(CWD, 'packages');

const subProjects = fs.readdirSync(packagesDir);
const conflictFiles = [];
const changedPackages = [];
const beforePackageJson = {};

// 1. 记录每个项目svn update前的package.json内容
for (const project of subProjects) {
  const projectPath = path.join(packagesDir, project);
  if (fs.lstatSync(projectPath).isDirectory()) {
    const pkgJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      beforePackageJson[project] = fs.readFileSync(pkgJsonPath, 'utf-8');
    }
  }
}

// 2. 执行svn update并检测冲突
for (const project of subProjects) {
  const projectPath = path.join(packagesDir, project);
  if (fs.lstatSync(projectPath).isDirectory()) {
    console.log(`\n正在为 ${project} 执行 svn update...`);
    try {
      const output = execSync('svn update', { cwd: projectPath, encoding: 'utf-8' });
      console.log(output);
      // 检查输出中是否有冲突标记
      const lines = output.split('\n');
      lines.forEach(line => {
        if (line.startsWith('C    ')) {
          const conflictPath = line.replace('C    ', '').trim();
          conflictFiles.push(path.join(projectPath, conflictPath));
        }
      });
    } catch (error) {
      console.error(`${project} svn update 失败: ${error.message}`);
      if (error.stdout) {
        const lines = error.stdout.split('\n');
        lines.forEach(line => {
          if (line.startsWith('C    ')) {
            const conflictPath = line.replace('C    ', '').trim();
            conflictFiles.push(path.join(projectPath, conflictPath));
          }
        });
      }
    }
  }
}

// 3. 对比svn update前后的package.json内容
for (const project of subProjects) {
  const projectPath = path.join(packagesDir, project);
  if (fs.lstatSync(projectPath).isDirectory()) {
    const pkgJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(pkgJsonPath) && beforePackageJson[project] !== undefined) {
      const afterContent = fs.readFileSync(pkgJsonPath, 'utf-8');
      if (beforePackageJson[project] !== afterContent) {
        changedPackages.push(pkgJsonPath);
      }
    }
  }
}

if (conflictFiles.length > 0) {
  console.log('\n发现以下svn冲突文件：');
  conflictFiles.forEach(file => console.log(file));
} else {
  console.log('\n所有包svn update完成，无冲突。');
}

if (changedPackages.length > 0) {
  console.log('\n以下package.json文件在svn update后发生了变化：');
  changedPackages.forEach(file => 
    console.log('\x1b[1m\x1b[31m%s\x1b[0m', file)
  );
} else {
  console.log('\n所有项目的package.json在svn update后均无变化。');
}
