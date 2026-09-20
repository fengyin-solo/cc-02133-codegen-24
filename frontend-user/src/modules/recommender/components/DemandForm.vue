<template>
  <el-card shadow="never" class="demand-card">
    <template #header>
      <div class="card-head">
        <span class="card-title">
          <el-icon><EditPen /></el-icon>
          填写业务需求
        </span>
        <el-tag size="small" type="info" effect="plain">三个维度均选择后才能获得推荐</el-tag>
      </div>
    </template>

    <div class="quick-scenes">
      <span class="quick-label">快速场景：</span>
      <el-button
        v-for="scene in QUICK_SCENES"
        :key="scene.key"
        size="small"
        round
        :type="isSceneActive(scene) ? 'primary' : 'default'"
        @click="$emit('quick-scene', scene)"
      >
        {{ scene.label }}
      </el-button>
      <el-button size="small" round @click="$emit('clear')">
        <el-icon><RefreshLeft /></el-icon> 清空需求
      </el-button>
    </div>

    <el-form label-position="top" class="demand-form">
      <el-form-item
        v-for="dim in dimensionList"
        :key="dim.key"
        :label="dim.label"
        required
      >
        <el-select
          :model-value="modelValue[dim.key]"
          :placeholder="`请选择${dim.label}`"
          size="large"
          class="dim-select"
          @update:model-value="(v) => emitChange(dim.key, v)"
        >
          <el-option
            v-for="opt in dim.options"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <div class="form-actions">
      <el-button
        type="primary"
        size="large"
        class="submit-btn"
        :loading="loading"
        @click="$emit('submit')"
      >
        <el-icon><MagicStick /></el-icon>
        获取方案推荐
      </el-button>
      <span class="tip">推荐结果将锁定在点击时的已发布版本</span>
    </div>
  </el-card>
</template>

<script setup>
import { DIMENSIONS, DIMENSION_KEYS } from '../engine/constants.js'
import { QUICK_SCENES } from '../seed.js'

const props = defineProps({
  modelValue: { type: Object, required: true },
  loading: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'submit', 'quick-scene', 'clear'])

const dimensionList = DIMENSION_KEYS.map((k) => DIMENSIONS[k])

function emitChange(key, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function isSceneActive(scene) {
  return DIMENSION_KEYS.every((k) => props.modelValue[k] === scene.demand[k])
}
</script>

<style lang="scss">
.demand-card {
  border-radius: $radius-lg;
  border: 1px solid $border-light;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-xs;
}

.card-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: $text-primary;
}

.quick-scenes {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-xs;
  margin-bottom: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: $bg-color;
  border-radius: $radius-md;

  .quick-label {
    font-size: $font-size-sm;
    color: $text-regular;
    margin-right: 4px;
  }
}

.demand-form {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0 $spacing-md;

  .dim-select {
    width: 100%;
  }
}

.form-actions {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  margin-top: $spacing-sm;

  .submit-btn {
    min-width: 180px;
  }
  .tip {
    font-size: $font-size-xs;
    color: $text-secondary;
  }
}

@media (max-width: $breakpoint-md) {
  .demand-form {
    grid-template-columns: 1fr;
  }
}
</style>
