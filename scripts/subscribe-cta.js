/* global hexo */
'use strict';

// 在每篇文章正文末尾注入订阅入口（Fluid 主题的 postMarkdownEnd 注入点）
hexo.extend.filter.register('theme_inject', function(injects) {
  if (!injects || !injects.postMarkdownEnd) return;

  injects.postMarkdownEnd.raw('subscribe-cta', `
<div class="sub-cta">
  <p class="sub-cta-title">喜欢这篇文章？</p>
  <p class="sub-cta-desc">订阅后，新文章会直接发到你的邮箱，随时可以退订。</p>
  <a class="sub-cta-btn" href="/subscribe/">邮箱订阅</a>
</div>
`, {}, {}, 10);
});
