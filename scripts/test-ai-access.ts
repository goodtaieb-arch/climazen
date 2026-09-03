import assert from 'node:assert/strict'
import {
  canUseAgentActions,
  canUseChatbot,
  canCallCloudAi,
  resolveAiTier,
  parseAiPlan,
} from '../src/lib/aiAccess'

assert.equal(resolveAiTier({ appEdition: 'pro' }), 'agent')
assert.equal(resolveAiTier({ appEdition: 'pro', aiPlan: undefined }), 'agent')

assert.equal(resolveAiTier({ appEdition: 'light', isBeta: true }), 'none')
assert.equal(resolveAiTier({ appEdition: 'light', isBeta: true, aiPlan: 'agent' }), 'agent')

assert.equal(resolveAiTier({ appEdition: 'light', isBeta: false }), 'chatbot')
assert.equal(resolveAiTier({ appEdition: 'light', isBeta: false, aiPlan: 'agent' }), 'agent')

assert.equal(canUseChatbot('none'), false)
assert.equal(canUseChatbot('chatbot'), true)
assert.equal(canUseChatbot('agent'), true)

assert.equal(canUseAgentActions('none'), false)
assert.equal(canUseAgentActions('chatbot'), false)
assert.equal(canUseAgentActions('agent'), true)
assert.equal(canCallCloudAi('agent'), true)
assert.equal(canCallCloudAi('chatbot'), false)

assert.equal(parseAiPlan('agent'), 'agent')
assert.equal(parseAiPlan('chatbot'), undefined)
assert.equal(parseAiPlan(undefined), undefined)

console.log('ok test-ai-access')
