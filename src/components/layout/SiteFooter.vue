<template>
  <footer class="site-footer">
    <a
      href="https://beian.miit.gov.cn/"
      target="_blank"
      rel="noopener noreferrer"
      class="footer-link"
    >浙ICP备2026067784号‑1</a>
    <span class="footer-sep">|</span>
    <a
      href="https://beian.mps.gov.cn/#/query/webSearch?code=33011002020403"
      target="_blank"
      rel="noopener noreferrer"
      class="footer-link footer-beian"
    >
      <img src="@/assets/beian.png" alt="公安备案" class="beian-icon" />
      <span>浙公网安备33011002020403号</span>
    </a>
  </footer>
</template>

<style scoped>
.site-footer {
  width: 100%;
  text-align: center;
  padding: 10px 0;
  font-size: 12px;
  color: #666;
  background: rgba(245, 245, 245, 0.6);
}

.footer-link {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  color: #666;
  text-decoration: none;
}

.footer-link:hover {
  color: #333;
}

.footer-sep {
  display: inline-flex;
  align-items: center;
  margin: 0 8px;
  color: #ccc;
}

.footer-beian {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.beian-icon {
  width: 16px;
  height: 16px;
  margin-right: 4px;
}
</style>
