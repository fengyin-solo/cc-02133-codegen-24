/**
 * 测试用 vue 桩：让 reactive 退化为「深层可写普通对象 + watch 空实现」，
 * 避免为测试引入完整 Vue 运行时；仓库逻辑本身不依赖响应式才能正确工作。
 */
export function reactive(obj) {
  return obj
}
export function computed(fn) {
  return { get value() { return fn() } }
}
export function watch() {}
export function ref(v) {
  return { value: v }
}
export default {}
