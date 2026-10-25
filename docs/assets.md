# 素材来源

| 素材                    | 来源                                                                                                   | 许可/使用方式        |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | -------------------- |
| 首页寝室插画            | 本项目 `src/components/RoomIllustration.tsx` 与 `src/styles.css` 原创                                  | 随项目 MIT           |
| favicon                 | 本项目 `public/favicon.svg` 原创粉色像素蝴蝶结                                                         | 随项目 MIT           |
| 装饰与导航图形          | Unicode 系统字符                                                                                       | 不加载外部字体或图片 |
| M1 寝室地图             | 本项目 `src/pages/RoomPage.tsx` 与 `src/styles.css` 原创 DOM/CSS 网格                                  | 随项目 MIT           |
| 室友像素头像            | 本项目 `src/render/pixels.ts`、`src/render/avatar.ts` 原创 16×16 像素与本地配色，Canvas 合成 data URL  | 随项目 MIT           |
| M3 全身预览与衣物缩略图 | 本项目 `src/render/pixels.ts`、`src/components/CharacterPreview.tsx` 原创矩形像素图层，以本地 SVG 渲染 | 随项目 MIT           |
| M3 24 件服装            | 本项目 `src/data/clothes.ts` 原创名称、描述、条件与像素图案；三槽各八款                                | 随项目 MIT           |

目前没有第三方图片、音频或字体。首页插画仅作装饰；`#/room` 是实际可操作地图。头像按外观签名缓存，最多保留 96 种组合，服装/颜色签名变化时重新合成。心情使用系统 emoji。

M7 的 `public/icons/heart-{192,512}.png` 为原创像素爱心图标，`public/sounds/chime.wav` 为原创 C/E/G 三音提示音（16 kHz、16 位单声道、0.36 秒）。均由随仓库的 Node 脚本 `build/generate-assets.mjs` 程序生成，可用 `node build/generate-assets.mjs` 重建，随项目 MIT 发布。生成器不参与游戏运行，不下载外部素材。角色/服装图鉴继续复用原创像素图层。

M2 将首页插画、地图与全部页面统一为樱粉/奶白色板；爱心靠枕、蕾丝边与格纹为原创 CSS，蝴蝶结/爱心/身份图案使用系统 Unicode/emoji，不下载任何远程素材。

M3 的全身人物、袖型、裤型、发型、蝴蝶结、星星、小鸭与花边均由本地像素矩形组合；Canvas 仅用于圆形头像，地图为 DOM/CSS，全身预览为 SVG。没有使用第三方人物、服装图片或在线生成服务。

本次扩展新增的六种脸型、裙装、女仆泡泡袖/围裙/蕾丝头饰、蝴蝶结、妆容与长袜图案均由 `src/render/pixels.ts` 原创像素矩形绘制，服装总数 32，随项目 MIT 发布，无第三方人物或远程素材。
