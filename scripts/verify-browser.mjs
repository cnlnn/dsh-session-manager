import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function verifyPlugin({ page, origin, workspace, home, manifest, command, env }) {
  const seed = join(workspace, 'seed.mjs')
  await writeFile(seed, `import { Context } from '@deepseek-ai/cordis';
import Sessions from '@deepseek-ai/dsh-session';
import * as Jsonl from '@deepseek-ai/dsh-session-persistence-jsonl';
const ctx = new Context();
try {
 await ctx.plugin(Sessions); await ctx.plugin(Jsonl.default ?? Jsonl, {root: ${JSON.stringify(join(home, 'sessions'))}, compression:'zstd'});
 const session=ctx.sessions.prepare('session-11111111-1111-4111-8111-111111111111',{meta:{cwd:${JSON.stringify(workspace)}}});
 const handle=await ctx.sessionPersistence.create(session.header);
 const event={seq:0,time:Date.now(),type:'session/title',data:{title:'Compatibility fixture',source:{kind:'user'},messageSeqs:[]}};
 if(handle){await handle.append([event]);await handle.flush();await handle.close();}else await ctx.sessionPersistence.append(session.header.id,[event]);
}finally{await ctx.fiber.dispose();}`)
  command(process.execPath, [seed], workspace, env)
  const endpoint = `${origin}/plugins/${manifest.name}/api`
  const inventory = async () => {
    const response = await page.request.get(`${endpoint}/sessions`)
    assert.equal(response.status(), 200)
    const body = await response.json()
    assert.equal(body.ok, true)
    return body.value
  }
  const id = 'session-11111111-1111-4111-8111-111111111111'
  const initial = await inventory()
  assert.ok(initial.sessions.some(row => row.id === id))
  const count = initial.sessions.length
  await page.getByRole('button', { name: /^(账号菜单|Account menu)$/ }).click()
  await page.getByRole('menuitem', { name: /^(设置|Settings)$/ }).click()
  await page.getByRole('button', { name: '会话管理', exact: true }).click()
  await page.getByRole('searchbox', { name: '搜索会话' }).fill(id)
  await page.getByRole('tab', { name: `会话 ${count}`, exact: true }).waitFor()
  await page.locator('.dsm-root button[title="移到回收站"]').click()
  await page.getByRole('button', { name: '移到回收站', exact: true }).click()
  await page.getByRole('tab', { name: `会话 ${count - 1}`, exact: true }).waitFor()
  assert.equal((await inventory()).trash.length, 1)
  await page.getByRole('tab', { name: '回收站 1', exact: true }).click()
  await page.locator('.dsm-root button[title="恢复"]').click()
  await page.getByRole('tab', { name: `会话 ${count}`, exact: true }).waitFor()
  assert.equal((await inventory()).sessions.find(row => row.id === id).title, 'Compatibility fixture')
  await page.getByRole('tab', { name: `会话 ${count}`, exact: true }).click()
  await page.locator('.dsm-root button[title="永久删除"]').click()
  await page.getByRole('button', { name: '永久删除', exact: true }).click()
  await page.getByRole('tab', { name: `会话 ${count - 1}`, exact: true }).waitFor()
  const final = await inventory()
  assert.equal(final.sessions.length, count - 1)
  assert.ok(!final.sessions.some(row => row.id === id))
  assert.equal(final.trash.length, 0)
}
