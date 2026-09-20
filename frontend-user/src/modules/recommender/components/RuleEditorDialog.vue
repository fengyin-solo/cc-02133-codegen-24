<template>
  <el-dialog
    :model-value="modelValue"
    :title="form.id ? '编辑规则' : '新建规则'"
    width="640px"
    @update:model-value="$emit('update:modelValue', $event)"
    @closed="$emit('closed')"
  >
    <el-form label-position="top">
      <el-form-item label="规则名称" required>
        <el-input v-model="form.name" placeholder="例如：中型跨区仓配 → 仓配一体" />
      </el-form-item>

      <el-form-item label="命中后推荐的方案" required>
        <el-select v-model="form.solutionId" placeholder="选择物流解决方案" class="full">
          <el-option
            v-for="s in solutionList"
            :key="s.id"
            :label="s.name"
            :value="s.id"
          >
            <span>{{ s.name }}</span>
            <span class="option-desc">{{ s.suitable }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-divider content-position="left">匹配条件</el-divider>

      <el-form-item
        v-for="dim in dimensionList"
        :key="dim.key"
        :label="dim.label"
      >
        <el-radio-group v-model="wildcard[dim.key]" @change="onWildcardChange(dim.key)">
          <el-radio :value="false">限定取值（可多选，命中其一即可）</el-radio>
          <el-radio :value="true">不限（通配，任意取值命中）</el-radio>
        </el-radio-group>
        <el-select
          v-if="!wildcard[dim.key]"
          v-model="selected[dim.key]"
          multiple
          collapse-tags
          collapse-tags-tooltip
          :placeholder="`选择${dim.label}取值`"
          class="full dim-values"
        >
          <el-option
            v-for="opt in dim.options"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="优先级（数字越大越优先；同具体度时生效）">
        <el-input-number v-model="form.priority" :min="0" :max="999" />
      </el-form-item>

      <el-form-item label="规则状态">
        <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="onSave">保存到草稿</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { DIMENSIONS, DIMENSION_KEYS, WILDCARD } from '../engine/constants.js'
import { SOLUTIONS } from '../seed.js'
import { store } from '../store.state.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  rule: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'saved', 'closed'])

const dimensionList = DIMENSION_KEYS.map((k) => DIMENSIONS[k])
const solutionList = Object.values(SOLUTIONS)

const form = reactive({
  id: '',
  name: '',
  solutionId: '',
  priority: 10,
  enabled: true
})
const selected = reactive({
  businessScale: [],
  storageNeed: [],
  deliveryScene: []
})
const wildcard = reactive({
  businessScale: true,
  storageNeed: true,
  deliveryScene: true
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    const r = props.rule
    form.id = r?.id || ''
    form.name = r?.name || ''
    form.solutionId = r?.solutionId || ''
    form.priority = r?.priority ?? 10
    form.enabled = r?.enabled ?? true
    for (const key of DIMENSION_KEYS) {
      const cond = r?.conditions?.[key] ?? WILDCARD
      if (cond === WILDCARD || !cond) {
        wildcard[key] = true
        selected[key] = []
      } else {
        wildcard[key] = false
        selected[key] = Array.isArray(cond) ? [...cond] : [cond]
      }
    }
  }
)

function onWildcardChange(key) {
  if (wildcard[key]) selected[key] = []
}

function onSave() {
  const conditions = {}
  for (const key of DIMENSION_KEYS) {
    conditions[key] = wildcard[key] ? WILDCARD : selected[key]
  }
  const rulePayload = { ...form, conditions }
  try {
    const saved = store.upsertRule(rulePayload)
    ElMessage.success('规则已保存到草稿（尚未对访客生效，需发布版本）')
    emit('saved', saved)
    emit('update:modelValue', false)
  } catch (err) {
    if (err.name === 'PermissionDeniedError') {
      ElMessage.error(`${err.message}。替代路径：请切换为规则管理员角色`)
    } else if (err.name === 'RuleValidationError') {
      ElMessage.error(err.details.errors.join('；') || err.message)
    } else {
      ElMessage.error(err.message)
    }
  }
}
</script>

<style lang="scss">
.full {
  width: 100%;
}
.dim-values {
  margin-top: $spacing-xs;
}
.option-desc {
  float: right;
  color: $text-secondary;
  font-size: $font-size-xs;
  max-width: 320px;
}
</style>
