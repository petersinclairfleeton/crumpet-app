import { describe, expect, it } from 'vitest';
import { accountMessage } from '../../src/data/account';

describe('accounts', () => {
  it('turns the account service’s error codes into plain words', () => {
    expect(accountMessage('WEAK_PASSWORD : Password should be at least 6 characters')).toBe('Choose a longer password: at least 6 characters.');
    expect(accountMessage('INVALID_LOGIN_CREDENTIALS')).toBe('That email and password don’t match an account.');
    expect(accountMessage('SOMETHING_NEW')).toMatch(/didn’t work/);
  });
});
