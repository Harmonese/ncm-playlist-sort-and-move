<p align="center">
  <img src="assets/icon.svg" alt="网易云音乐歌单排序" width="128">
</p>

<h1 align="center">网易云音乐歌单排序</h1>

<p align="center">网易云音乐网页版歌单管理用户脚本</p>

<p align="center">
  <a href="https://github.com/Harmonese/ncm-playlist-sort-and-move/actions/workflows/build.yml"><img src="https://github.com/Harmonese/ncm-playlist-sort-and-move/actions/workflows/build.yml/badge.svg?branch=main" alt="Build Status"></a>
  <a href="https://github.com/Harmonese/ncm-playlist-sort-and-move/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Harmonese/ncm-playlist-sort-and-move" alt="License"></a>
  <img src="https://img.shields.io/badge/version-0.9.2-e00214" alt="Version 0.9.2">
  <img src="https://img.shields.io/badge/userscript-Tampermonkey%20%7C%20Violentmonkey-e00214" alt="Userscript manager compatibility">
</p>

网易云音乐网页版歌单管理用户脚本，用于给歌单增加编排脚本、排序、批量移动和批量删除能力。

> 当前项目还处在早期阶段。脚本会直接修改你的网易云歌单，请先在测试歌单中验证效果。

## 功能

- 按歌曲标题排序，支持自定义拉丁字母、汉字、日文假名、韩文、西里尔字母、希腊字母、阿拉伯字母、数字和其他字符的优先级。
- 按发行日期排序，支持从新到旧和从旧到新，并可在日期相同时按专辑名称、专辑内曲目顺序排列。
- 按歌手排序，使用与标题排序相同的文字比较规则，并可在同一歌手内按发行时间排序。
- 按热度排序，支持按红心数量、热度值或评论数量进行升序、降序排列。
- 随机排序整个歌单或指定歌曲区间。
- 使用歌单编辑器按歌曲 ID 编辑并重建歌单，也可以通过命令行按专辑 ID 展开歌曲。
- 通过 `.nplc`（NCM Playlist Command）纯文本文件导入或导出一组歌单命令。
- 手动拖动歌曲或文字体系优先级调整顺序，支持键盘上下移动。
- 按序号区间批量移动歌曲。
- 按序号区间批量删除歌曲。
- 排序、移动或删除后恢复上一次操作前的歌单顺序。
- 支持歌曲数量较多的歌单，会分批拉取歌曲详情。

## 安装

1. 安装浏览器用户脚本管理器，例如 Tampermonkey 或 Violentmonkey。
2. 打开脚本文件：
   - 安装地址：`https://raw.githubusercontent.com/Harmonese/ncm-playlist-sort-and-move/main/ncm-playlist-sort-and-move.user.js`
   - GitHub 仓库：`https://github.com/Harmonese/ncm-playlist-sort-and-move`
   - 本地开发文件：`ncm-playlist-sort-and-move.user.js`
3. 将脚本安装到用户脚本管理器中。
4. 打开网易云音乐网页版并进入歌单页。
5. 点击歌单操作区里的“歌单排序工具”按钮。

## 使用说明

进入网易云音乐网页版歌单页后，脚本会在歌单操作区注入“歌单排序工具”按钮。点击后可以选择：

- 歌单编辑器：右侧显示当前编辑结果，下方命令行支持插入、清空、删除、移动、交换和排序命令。编辑结果按歌单 ID 保存在用户脚本存储中，再次打开同一歌单时会自动加载。应用前会预览新增、移除和顺序变化，并检测当前歌单是否偏离上次应用后的状态。
- 按标题排序：根据歌曲标题从左到右逐个字符比较，支持统一的文字体系优先级和汉字排序方式。
- 按发行日期排序：根据歌曲或专辑发行时间排序，可在确认前选择排序方向，以及日期相同时的专辑和曲目顺序。
- 按歌手排序：按歌手名称从左到右比较，使用与标题排序相同的文字比较规则。歌手分组可以按名称排序，也可以保持原歌单中首次出现的顺序；每个分组内部可以保持原顺序或按发行日期排序。发行日期方向和“按发行日期排序”共享。
- 按热度排序：可以选择红心数量、热度值或评论数量，并选择升序或降序。红心数量使用网易云 `/api/song/red/count` 接口；热度值使用歌曲详情接口提供的 `popularity` 字段；评论数量使用批量接口获取。缺失或请求失败的指标排在末尾，相同指标保持原歌单顺序。
- 随机排序：在排序工具菜单中直接随机打乱当前歌单，并保存排序前顺序以便恢复。
- 手动排序：在手动排序弹窗中拖动歌曲调整顺序，也可以聚焦右侧拖拽手柄后使用方向键移动；确认后会写回当前歌单。
- 批量移动歌曲：输入起始位置、结束位置和目标位置，将指定区间移动到目标歌曲后面。
- 批量删除歌曲：输入起始位置和结束位置，删除对应区间内的歌曲。

排序、移动或删除成功后会保存操作前的歌单顺序，可以从“歌单排序工具”菜单中恢复最近一次操作。删除操作的恢复会尝试重新加入已删除歌曲。

按标题排序时，脚本会先识别当前歌单标题中实际出现的文字体系，只在设置中显示这些类别。用户可以调整拉丁字母、汉字、日文假名、韩文、西里尔字母、希腊字母、阿拉伯字母、数字和其他字符的优先级，也可以选择汉字的排序方式：拼音顺序、笔画顺序或 Unicode 顺序。标题排序设置会自动保存，下次打开时恢复。拉丁字母类别包含英语、法语、德语等使用拉丁文字系统的字符。文字体系分类基于 Unicode 字符属性，不进行语言或歌名内容的智能识别。拼音顺序会比较不带声调的拼音键，拼音相同时继续比较后面的字符，整首标题拼音相同才使用原始标题的 Unicode 顺序兜底。开启“使用直接字符串比较”后会关闭这些类别规则。标题会按原始内容从左到右比较，不会自动清理标题前缀。

标题排序和歌手排序使用同一套文字比较设置。两种排序弹窗都会显示这套设置，在任一处修改并确认后，另一处会同步使用；两边识别的是各自的标题或歌手文本，所以实际显示的文字体系可能不同。发行日期排序的方向、专辑名称和专辑内曲目顺序设置会在日期排序和歌手排序之间共享，两种弹窗都会显示完整的发行日期设置。

歌单编辑器的歌曲列表使用以下格式保存：

```text
song 654321
song 186003
```

右侧内容是当前歌单的完整歌曲列表，只读显示，不能直接编辑。需要添加专辑时，在命令行输入 `album <专辑ID>`，读取成功后会将专辑曲目加入列表。ID 是唯一依据，名称和歌手名称不参与匹配；空列表、无效 ID、展开后的重复歌曲都会阻止写回。旧版本已经保存的专辑命令会在再次打开时尝试自动展开为歌曲命令。

歌曲列表为空时表示目标歌单为空；`clear` 会清空当前编辑结果，之后可以继续插入歌曲或专辑。每次命令行操作都会基于最新列表重新计算位置。

命令行示例：

```text
song 123 0
album 456 10
remove 2 5
move 2 5 0
swap 2 8
sort title
sort title 2 10
sort date desc album track 2 10
sort artist name date
sort heat popularity desc
sort random
sort random 2 10
```

`song` 和 `album` 的 position 是 0-based 插入位置，范围为 `0..当前歌曲数`。`remove` 的区间和 `move` 的起止位置使用 1-based、包含首尾的歌曲位置；`move` 的 target 是 0-based 插入位置，`0` 表示最前，其他位置表示插入到对应歌曲之后。排序命令没有区间时作用于整个执行方案，末尾两个整数表示 1-based、包含首尾的排序区间。排序参数省略时使用当前排序设置，显式参数只对本次命令生效。
`sort random` 不需要额外参数；末尾两个整数仍可指定 1-based、包含首尾的随机排序区间。

### `.nplc` 命令文件

`.nplc` 是 UTF-8 纯文本格式的 NCM Playlist Command 文件，一行一条命令。命令行旁的“上传 .nplc”会先检查整个文件，确认格式无误后再按文件顺序逐条执行；某条命令执行失败时会停止后续命令。文件可以包含空行和以 `#` 开头的注释。

“下载 .nplc”会下载当前编辑窗口中的命令记录：包括打开编辑器时已有的 `song <歌曲ID>` 列表，以及之后通过命令行或 `.nplc` 文件成功执行的命令。下载的文件会由浏览器保存到默认下载目录，不会自动上传或写回网易云歌单。

## 风险提示

- 排序、移动和删除都会直接写回当前歌单。
- 批量删除支持在歌曲集合未发生其他变化时尝试恢复，但重新加入歌曲可能受歌曲下架、权限或接口限制影响。
- 建议先复制一个测试歌单，确认排序规则符合预期后再处理重要歌单。
- 网易云音乐内部接口可能变化，脚本可能在未来需要适配。
- 排序、批量移动和批量删除成功后会保存操作前顺序，可从工具菜单恢复；如果歌单歌曲集合已经发生其他变化，脚本会拒绝恢复以避免误写。

## 本地开发

源码位于 `src/` 目录，最终可安装的用户脚本由源码构建生成。

```bash
npm install
npm run verify
npx playwright install chromium
npm run test:browser
```

`npm run verify` 会构建 `ncm-playlist-sort-and-move.user.js`，并检查生成文件的 JavaScript 语法。
`npm run test:browser` 会启动本地测试页面，用 Playwright Chromium 驱动真实歌单编排弹窗，覆盖命令执行、排序、删除、插入、歌曲元数据显示和预览选中状态；测试使用 Mock 数据，不需要网易云登录，也不会访问网易云接口。首次运行前执行一次 `npx playwright install chromium` 即可。浏览器测试单独运行，不会让普通 `npm test` 依赖本机浏览器。

推送涉及源码或构建配置的提交到 `main` 后，GitHub Actions 也会自动执行同样的构建和检查，并在构建产物有变化时将更新后的用户脚本提交回仓库。配合 Greasy Fork Webhook，可以实现后续版本的自动同步。

主要目录职责如下：

- `assets/`：项目 Logo 的 SVG 源文件和用户脚本使用的 PNG 图标。
- `src/main.js`：脚本入口和页面按钮注入。
- `src/ui/`：菜单、输入框和确认弹窗。
- `src/operations/`：排序、移动、删除等完整操作流程。
- `src/ncm/`：网易云接口、请求和 weapi 加密。
- `src/data/`：歌曲和歌单数据整理。
- `src/settings/`：标题、歌手、发行日期设置以及按歌单保存的编排脚本。
- `src/sort/`：标题、歌手和发行日期排序规则。
- `src/utils/`：通用工具函数。

## 更新日志

详细更新记录见 [CHANGELOG.md](CHANGELOG.md)。

## License

MIT
