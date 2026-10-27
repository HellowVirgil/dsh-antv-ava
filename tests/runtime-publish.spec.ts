// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateRuntimeMetadata } from '../scripts/check-runtime-publish.mjs'

function metadata() {
  const repository = { url: 'git+https://github.com/HellowVirgil/dsh-antv-ava.git' }
  return {
    base: { name: 'dsh-antv-ava', version: '0.3.2', repository },
    runtime: { name: 'dsh-antv-ava-runtime', version: '0.1.2' },
    packed: {
      name: 'dsh-antv-ava-runtime', version: '0.1.2', repository,
      publishConfig: { access: 'public', registry: 'https://registry.npmjs.org/' },
      dependencies: { 'dsh-antv-ava': '0.3.2', '@antv/ava': '4.0.0-beta.2' },
    },
    tag: 'v0.3.2',
    prerelease: false,
  }
}
describe('runtime trusted-publish metadata', () => {
  it('allows a public runtime bound to its exact base release', () => {
    expect(validateRuntimeMetadata(metadata())).toBe('latest')
  })
  it('rejects a private or mismatched runtime archive', () => {
    const privatePackage = metadata()
    expect(() => validateRuntimeMetadata({ ...privatePackage, packed: { ...privatePackage.packed, private: true } })).toThrow('private')
    const wrongArchive = metadata(); wrongArchive.packed.version = '0.1.1'
    expect(() => validateRuntimeMetadata(wrongArchive)).toThrow('identity')
  })
  it('rejects local or wrong-version base dependencies', () => {
    for (const dependency of ['workspace:*', 'file:../', '0.3.1']) {
      const data = metadata(); data.packed.dependencies['dsh-antv-ava'] = dependency
      expect(() => validateRuntimeMetadata(data)).toThrow('exact base')
    }
  })
  it('binds the registry and repository to the release', () => {
    const registry = metadata(); registry.packed.publishConfig.registry = 'https://example.com/'
    expect(() => validateRuntimeMetadata(registry)).toThrow('registry')
    const repository = metadata(); repository.packed.repository = { url: 'git+https://github.com/other/repo.git' }
    expect(() => validateRuntimeMetadata(repository)).toThrow('repository')
  })
  it('requires matching prerelease status for both packages', () => {
    const data = metadata(); data.runtime.version = data.packed.version = '0.1.2-beta.1'
    expect(() => validateRuntimeMetadata(data)).toThrow('prerelease')
    data.base.version = data.packed.dependencies['dsh-antv-ava'] = '0.3.2-beta.1'
    data.tag = 'v0.3.2-beta.1'; data.prerelease = true
    expect(validateRuntimeMetadata(data)).toBe('next')
  })
  it('rejects a tag that does not identify the base version', () => {
    const data = metadata(); data.tag = 'v0.3.1'
    expect(() => validateRuntimeMetadata(data)).toThrow('tag')
  })
})
