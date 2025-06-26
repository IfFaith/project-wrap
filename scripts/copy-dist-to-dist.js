const fs = require('fs');
const path = require('path');

const CWD = process.cwd();
const packagesDir = path.join(CWD, 'packages');
const distDir = path.join(CWD, 'dist');

// 如果存在dist目录  先清空
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
  console.log('清空dist目录成功');
}
fs.mkdirSync(distDir, { recursive: true });
console.log('创建dist目录成功')
// 递归复制文件夹内容到目标目录
function copyFolderRecursive(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  const items = fs.readdirSync(source);
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const targetPath = path.join(target, item);
    if (fs.lstatSync(sourcePath).isDirectory()) {
      copyFolderRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// 遍历packages下所有子项目
const subProjects = fs.readdirSync(packagesDir);
for (const project of subProjects) {
  const projectPath = path.join(packagesDir, project);
  if (fs.lstatSync(projectPath).isDirectory()) {
    const distPath = path.join(projectPath, 'dist');
    if (fs.existsSync(distPath)) {
      console.log(`正在复制 ${project} 的dist内容到dis目录...`);
      copyFolderRecursive(distPath, distDir);
      console.log(`${project} 的dist内容复制完成`);
    } else {
      console.log(`警告: ${project} 下没有dist目录，跳过`);
    }
  }
}

console.log('所有dist内容已成功复制到dis目录'); 