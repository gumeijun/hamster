# Hamster - 免费好用的 MySQL 数据库管理工具

> 🐹 **Hamster** 是一款基于 Electron 构建的现代化 MySQL 数据库管理工具，旨在成为 Navicat 的轻量级、免费平替方案。
>
> 🐹 **Hamster** is a modern MySQL database management tool built with Electron. It aims to be a lightweight, free alternative to Navicat.

<p align="center">
  <a href="./README.md">English</a> | <a href="./README_zh-CN.md">简体中文</a>
</p>

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)

## 📖 简介 | Introduction

Hamster 专为开发者和数据库管理员设计，提供了一个简洁、高效且完全免费的图形化界面来管理 MySQL 数据库。它集成了数据浏览、表结构设计、SQL 查询等核心功能，帮助你告别昂贵的商业软件订阅，轻松掌控数据。

## ✨ 核心亮点 | Features

*   💸 **永久免费**：开源免费，无需破解，零成本使用。
*   🚀 **轻量极速**：基于 Electron + React + Vite 技术栈，启动快，资源占用低。
*   🎯 **Navicat 平替**：还原经典操作习惯，零学习成本上手。
*   🛡️ **数据安全**：所有连接信息本地存储，数据直连数据库，安全可控。

## 🛠️ 功能特性 | Functionality

### 1. 多连接管理
*   支持创建、编辑、删除多个 MySQL 连接。
*   直观的连接树形视图，快速切换数据库。

### 2. 可视化表设计 (Table Designer)
*   **结构编辑**：支持添加、修改、删除字段（类型、长度、默认值、注释、非空约束等）。
*   **索引管理**：支持创建主键 (PRIMARY)、唯一索引 (UNIQUE)、普通索引 (NORMAL) 和全文索引 (FULLTEXT)。
*   **实时保存**：智能生成 `ALTER TABLE` 语句，安全更新表结构。

### 3. 高效数据管理 (Data Viewer)
*   **数据浏览**：支持分页查看海量数据。
*   **高级筛选**：内置丰富的筛选条件（`=`, `LIKE`, `IN`, `BETWEEN`, `IS NULL` 等），支持多条件组合查询。
*   **快捷编辑**：双击单元格直接修改数据。
*   **增删改查**：支持添加新记录、批量删除选中记录。
*   **自动刷新**：截断表 (Truncate) 或修改数据后自动刷新视图。

### 4. SQL 开发与维护
*   **SQL 查询编辑器**：支持多语句执行，快速验证 SQL 逻辑。
*   **导入导出**：
    *   支持导出数据库结构及数据 (`.sql`)。
    *   支持导入并执行 SQL 脚本文件。
*   **表操作**：支持截断表 (Truncate)、删除表 (Drop)、重命名表 (Rename)。

### 5. 现代化交互
*   **多标签页**：类似浏览器的多标签页设计，同时处理多张表或查询任务。
*   **右键菜单**：丰富的上下文菜单，操作触手可及。

## 🏗️ 技术栈 | Tech Stack

*   **Runtime**: Electron
*   **Frontend**: React, TypeScript, Tailwind CSS
*   **Build Tool**: Vite
*   **Database Driver**: mysql2
*   **Editor**: Monaco Editor (VS Code 同款编辑器核心)

## 🚀 快速开始 | Getting Started

### 开发环境 (Development)

```bash
# 1. 克隆项目
git clone https://github.com/gumeijun/hamster.git
cd hamster

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

### 打包构建 (Build)

```bash
# 构建生产安装包 (macOS/Windows/Linux)
npm run build
```

*构建产物将生成在 `release/` 目录下。*

## 🤝 贡献 | Contributing

欢迎提交 Issue 反馈 Bug 或 提交 Pull Request 贡献代码！让我们一起把 Hamster 打造成最好用的免费数据库管理工具。

## 📄 许可证 | License

ISC License © 2024 Gu
