import { config } from '@vue/test-utils'
import { i18n } from '../i18n'

config.global.plugins ??= []
config.global.plugins.push(i18n)

i18n.global.locale.value = 'zh-TW'
