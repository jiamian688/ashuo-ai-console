// 工作工具的统一清单。Dashboard 用来渲染卡片,Admin 用来配置账号能看到哪些工具。
export const TOOLS = [
  { key: 'clips', icon: '🖼', tint: '#eef0fb', color: '#6c5ce7', title: '剪辑管理', desc: '视频剪辑和封面图生成', to: '/clips' },
  { key: 'community', icon: '💬', tint: '#e7f6ec', color: '#16a34a', title: '社群管理', desc: '管理 TG 社群内容发布', to: '/community' },
  { key: 'social', icon: '➤', tint: '#e8effe', color: '#3b6fe0', title: '社媒管理', desc: 'AI 推特文案生成器 · 关键词→文案', to: '/social' },
  { key: 'meeting', icon: '🎥', tint: '#f3eafe', color: '#8b5cf6', title: 'Agent 会议室', desc: 'Fathom 会议 · AI 跟会记录 · 纪要导出 Word/PDF', to: '/meeting' },
  { key: 'comic', icon: '🎭', tint: '#2d106622', color: '#a855f7', title: '漫剧生产', desc: 'AI 剧本 · 分镜 · 角色图 · 图转视频 · 一站式流程', to: '/comic' },
  { key: 'businessData', icon: '📊', tint: '#e8fbf3', color: '#0d9b6c', title: '经营数据看板', desc: '自动读取后台每日收入/注册/日活/留存数据', to: '/business-data' },
  {
    key: 'contentReview',
    icon: '🛡',
    tint: '#fdeef0',
    color: '#e0446c',
    title: '内容审核',
    desc: 'AI 审核评论 + 帖子 · 一键通过/拒绝',
    submenu: [
      { key: 'commentReview', icon: '🛡', title: '评论审核助手', desc: 'AI 审核视频/社区/黄游/书评评论 · 一键通过/拒绝', to: '/comment-review' },
      { key: 'postReview', icon: '📝', title: '帖子审核', desc: 'AI 识图审核用户帖子(引流/无看点)· 一键通过/拒绝', to: '/post-review' },
    ],
  },
];
