## npm run upSVN：批量 SVN 更新并检测冲突

在需要对 packages 目录下所有子项目进行 svn update，并检测是否有冲突时，可以使用以下命令：

```bash
npm run upSVN
```

该脚本会自动遍历 packages 目录下的所有子项目，为每个项目执行 svn update。如果有冲突，会在终端输出所有冲突文件的完整路径；如果没有冲突，会提示"所有包 svn update 完成，无冲突。"

## npm run installAll ：统一安装所有项目依赖

在需要为 packages 目录下所有子项目执行 npm i --force 时，可以使用以下命令：

```bash
npm run installAll
```

该脚本会自动遍历 packages 目录下的所有子项目，并为每个项目执行 npm i --force 命令。

## npm run build ：统一打包所有项目

在需要为 packages 目录下项目进行打包时，可以使用以下命令：

```bash
npm run build
```

该脚本会自动遍历 packages 目录下的所有子项目，先执行 ihive-lib 的打包命令，并将 ihive 依赖包分别给每个分系统替换，之后为每个分系统执行 npm run build-all 指令

## npm run copy：统一复制 dist 内容到 dist 目录

在打包任务结束后，可以使用以下命令将 packages 目录下所有子项目的 dist 文件夹内容统一复制到根目录下的 dist 文件夹中：

```bash
npm run copy
```

该脚本会自动创建 dist 目录（如果不存在），并在复制前清空 dist 目录，确保内容为最新。

## 项目目录结构
```
├── README.md
├── .gitignore
├── package.json
├── package-lock.json
├── dist/
├── scripts/
│   ├── build.js
│   ├── copy-dist-to-dist.js
│   ├── install-all.js
│   └── svn-update-all.js
├── .git/
├── node_modules/
└── packages/
```
dist/：所有子项目打包后的产物目录
scripts/：自动化脚本目录
packages/：存放所有子项目（已被 .gitignore 忽略具体内容）
node_modules/：依赖目录（已被 .gitignore 忽略）
其他为项目配置及说明文件