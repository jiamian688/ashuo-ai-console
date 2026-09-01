// 每隔一段时间自动跑一遍评论审核(4个模块),不用再手动点按钮。
// 跟手动点"一键 AI 自动审核"走的是同一份逻辑(runAutoReview),行为完全一致。
import { activeProvider } from './llm.js';
import { commentAdminConfigured } from './commentAdmin.js';
import { runAutoReview } from './commentAutoReview.js';

const SOURCES = ['mv', 'post', 'porn', 'book'];
const INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 小时

async function runOnce() {
  if (!activeProvider() || !commentAdminConfigured()) {
    console.log('[评论定时审核] 未配置 AI 或管理后台 token,跳过本轮');
    return;
  }
  for (const source of SOURCES) {
    try {
      // 每个模块循环处理,直到清空或达到安全上限,跟"全部自动审核"按钮一致
      let round = 0;
      let totalReviewed = 0, totalPassed = 0, totalRejected = 0;
      for (;;) {
        round += 1;
        const r = await runAutoReview(source, { limit: 100, onlyToday: true });
        totalReviewed += r.reviewed;
        totalPassed += r.passed;
        totalRejected += r.rejected;
        if (!r.reviewed || round >= 20) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      // 每个模块每轮都打一行(哪怕 0 条),方便确认 4 个模块都在跑,而不是只看到视频在动
      console.log(`[评论定时审核] ${source}: 共 ${round} 轮,审核 ${totalReviewed} 条 · 通过 ${totalPassed} · 拒绝 ${totalRejected}`);
    } catch (err) {
      console.error(`[评论定时审核] ${source} 出错: ${err.message}`);
    }
  }
}

export function startCommentAutoReviewScheduler() {
  setInterval(() => { runOnce().catch((err) => console.error('[评论定时审核] 未捕获错误: ' + err.message)); }, INTERVAL_MS);
  console.log(`[评论定时审核] 定时任务已启动,每 ${INTERVAL_MS / 3600000} 小时自动跑一次(只审核当天新增)`);
}
