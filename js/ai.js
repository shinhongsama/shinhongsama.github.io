

new ChucklePostAI({
  /* 必须配置 */
  el: '#post>#article-container',
  
  // 1. 填入你购买的 DeepSeek Key
  key: 'sk-1dbc99ec20a14921a1d7e596a9076dbf', 

  /* 2. 补充接口地址（关键！） */
  // 如果插件支持，必须指定 DeepSeek 的官方地址，否则它会去请求 Tianli 的服务器
  api_url: 'https://api.deepseek.com/v1/chat/completions',
  model: 'deepseek-chat',

  /* 非必须配置 */
  title_el: '.post-title',
  rec_method: 'web',
  exclude: ['highlight', 'Copyright-Notice', 'post-ai', 'post-series', 'mini-sandbox']
})