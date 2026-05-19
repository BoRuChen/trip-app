import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useImageUrl } from '../useImageUrl'
import { saveImage, _resetForTest } from '@/stores/imageStore'

describe('useImageUrl', () => {
  const createObjectURL = vi.fn((_: Blob) => `blob:fake-${Math.random()}`)
  const revokeObjectURL = vi.fn()

  beforeEach(async () => {
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    await _resetForTest()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves to a blob URL after the image loads', async () => {
    const id = await saveImage(new Blob(['x'], { type: 'image/jpeg' }))

    let urlRef!: ReturnType<typeof useImageUrl>['url']
    const Comp = defineComponent({
      setup() {
        const idRef = ref(id)
        const { url } = useImageUrl(idRef)
        urlRef = url
        return () => h('div')
      },
    })
    mount(Comp)

    await new Promise((r) => setTimeout(r, 10))
    expect(urlRef.value).toMatch(/^blob:fake-/)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('resolves to null for an unknown id', async () => {
    let urlRef!: ReturnType<typeof useImageUrl>['url']
    const Comp = defineComponent({
      setup() {
        const idRef = ref('nope')
        const { url } = useImageUrl(idRef)
        urlRef = url
        return () => h('div')
      },
    })
    mount(Comp)

    await new Promise((r) => setTimeout(r, 10))
    expect(urlRef.value).toBeNull()
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('revokes the URL on unmount', async () => {
    const id = await saveImage(new Blob(['x']))
    const Comp = defineComponent({
      setup() {
        const idRef = ref(id)
        useImageUrl(idRef)
        return () => h('div')
      },
    })
    const wrapper = mount(Comp)

    await new Promise((r) => setTimeout(r, 10))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const created = createObjectURL.mock.results[0].value

    wrapper.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith(created)
  })

  it('revokes old URL and creates a new one when id changes', async () => {
    const id1 = await saveImage(new Blob(['a']))
    const id2 = await saveImage(new Blob(['b']))
    const idRef = ref(id1)

    const Comp = defineComponent({
      setup() {
        useImageUrl(idRef)
        return () => h('div')
      },
    })
    mount(Comp)
    await new Promise((r) => setTimeout(r, 10))

    idRef.value = id2
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))

    expect(createObjectURL).toHaveBeenCalledTimes(2)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
  })
})
