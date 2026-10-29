沪电动态PE展示，2026-10-29新增。

公式：未复权价格 × 最近已披露总股本 / 最近累计归母净利润年化。
历史按公告日期使用财报，股本取生效和公告较晚日期。接口历史比较数可能修订，页面明确标为估算，不可当作原始时点盲测。不得把本数据导入策略或订单。

更新：python3 scripts/update-valuation.py --if-due --state-dir ../../outputs/hudian-desktop/valuation
读取公开东方财富财报/股本、腾讯未复权日线，既有BaoStock日线作2020起种子。只纳入已收盘日（当天15:05以后），盘中点由网页最新报价临时估算。
每日AM/PM各至多成功更新一次，同半日最多两次请求尝试；失败不覆盖已发布数据。原始响应和状态保留在本机state-dir，不上传桌面日志。

本机 work/hudian-desktop/publish-fill-snapshot.py 已调用该更新脚本，并将 docs/valuation-history.json 加入公开文件白名单。实际worker盘前验收成功、成交状态变化及15:05收盘时沿用既有发布流程，不新增自动化。估值请求失败单独记 valuation-update-error.json，不能阻断成交导出或通知。网页每5分钟读取发布数据、复用每5秒价格回调估值；以报价和数据核验时间为准。

验证：python3 scripts/test-valuation.py；node test-valuation.mjs。页面可选全部/三年/一年，缩放，悬停查看报告期和口径，并下载PNG。
