import { describe, expect, it } from 'vitest';
import { extractJson } from './remote';

describe('relay parsing', () => {
  it('reads raw JSON and the jina reader wrapper', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    const wrapped = 'Title: \n\nURL Source: https://fantasy.premierleague.com/api/entry/1/\n\nMarkdown Content:\n{"id":1,"player_first_name":"A_B","leagues":{"classic":[]}}';
    expect(extractJson(wrapped)).toEqual({ id: 1, player_first_name: 'A_B', leagues: { classic: [] } });
    expect(extractJson('Markdown Content:\n[{"event":3}]')).toEqual([{ event: 3 }]);
    expect(() => extractJson('error page')).toThrow();
  });
});
