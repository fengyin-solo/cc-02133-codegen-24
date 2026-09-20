<template>
  <el-card shadow="never" class="timeline-card">
    <template #header>
      <span class="card-title">
        <el-icon><Files /></el-icon>
        已发布版本（不可变归档）
      </span>
    </template>

    <el-empty v-if="versions.length === 0" description="还没有已发布版本，访客侧暂无推荐规则" :image-size="80" />

    <el-timeline v-else>
      <el-timeline-item
        v-for="v in [...versions].reverse()"
        :key="v.id"
        :type="v.id === activeId ? 'success' : 'primary'"
        :hollow="v.id !== activeId"
        size="large"
        :timestamp="formatTime(v.publishedAt)"
        placement="top"
      >
        <div class="version-row">
          <el-tag :type="v.id === activeId ? 'success' : 'info'" effect="plain">
            {{ v.id }}
          </el-tag>
          <strong v-if="v.id === activeId" class="active-label">当前生效</strong>
          <span class="version-note">{{ v.note }}</span>
        </div>
        <div class="version-meta">
          规则 {{ v.rules.length }} 条（启用 {{ activeCount(v.rules) }} 条）· 发布人：{{ v.publishedBy }}
        </div>
      </el-timeline-item>
    </el-timeline>
  </el-card>
</template>

<script setup>
defineProps({
  versions: { type: Array, required: true },
  activeId: { type: String, default: null }
})

function activeCount(rules) {
  return rules.filter((r) => r.enabled !== false).length
}

function formatTime(iso) {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<style lang="scss">
.timeline-card {
  border-radius: $radius-lg;
  border: 1px solid $border-light;
}
.card-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.version-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  flex-wrap: wrap;
}
.active-label {
  color: $success-color;
  font-size: $font-size-sm;
}
.version-note {
  color: $text-regular;
  font-size: $font-size-sm;
}
.version-meta {
  margin-top: 4px;
  font-size: $font-size-xs;
  color: $text-secondary;
}
</style>
