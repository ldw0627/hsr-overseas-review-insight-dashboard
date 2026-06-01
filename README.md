# hsr-overseas-review-insight-dashboard
本项目是一个静态demo，用于分析《崩坏：星穹铁道》中国大陆以外的 App Store / Google Play 玩家评论，并生成一个本地网页工作台。主要结构：Dashboard + AI Action Center + Review Data Copilot。

核心能力：
- 海外 App Store / Google Play 评论抓取
- 评论清洗、去重、日期拆分
- LLM 情绪识别、问题分类、主题归因
- 原文评论中文翻译与缓存
- 地区表现、版本问题定位、竞品对比
- AI Action Center 运营决策建议
- Review Data Copilot 基于本地评论数据回答追问


当前正式版页面包含：
- 游戏总体健康度
- 星穹铁道 / 商店指标
- 情绪分布
- 负面问题类型
- 地区表现
- 各地区负面问题类型拆分
- 玩家抱怨焦点
- 版本问题定位
- 竞品对比 / 商店指标
- AI Action Center
- 高风险原声样本
- 产品与运营建议
- 右下角 Review Data Copilot
Review Data Copilot 不是直接把问题丢给 LLM。它会先查询本地已清洗、已分析、已翻译的数据，再把相关统计和代表评论作为上下文交给 LLM 生成回答。

改进点：
- 接入游戏相关数据指标
- 接入社媒平台数据以读取相关评论、转发、帖子来获取更多玩家反馈
