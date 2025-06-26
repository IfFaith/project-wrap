const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CWD = process.cwd();
const packagesDir = path.join(CWD, 'packages');

const subProjects = fs.readdirSync(packagesDir);
const conflictFiles = [];

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
        // svn 冲突通常以 'C    路径' 开头
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

if (conflictFiles.length > 0) {
  console.log('\n发现以下svn冲突文件：');
  conflictFiles.forEach(file => console.log(file));
} else {
  console.log('\n所有包svn update完成，无冲突。');
} 