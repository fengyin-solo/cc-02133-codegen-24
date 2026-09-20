/**
 * Node ESM loader：仅在测试环境把裸导入 `vue` 重定向到本地桩模块。
 * 用法：node --experimental-loader ./test/vue-loader.js --test
 */
import { pathToFileURL } from 'node:url'
import { resolve as resolvePath } from 'node:path'

const stub = pathToFileURL(resolvePath('./test/vue-stub.js')).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'vue') {
    return { url: stub, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
