import { describe, expect, it } from 'vitest';
import {
  POLLA_API_ROLES,
  POLLA_PAGE_ROLES,
  PollaPage,
  canSeePollaPage,
  pollaHomePage,
} from '@helper/polla/config/access.config';
import { POLLA_USER_TYPE, POLLA_USER_TYPE_LABEL } from '@helper/polla/types/user.type';

const PAGES = Object.keys(POLLA_PAGE_ROLES) as PollaPage[];
const pagesOf = (role: POLLA_USER_TYPE) => PAGES.filter((page) => canSeePollaPage(role, page));

const { OWNER, CAPITALIST, SUPERADMIN, ASSISTANT, ADMIN, CASHIER, PLAYER } = POLLA_USER_TYPE;

describe('el Súper (R11)', () => {
  it('se llama Súper', () => {
    expect(POLLA_USER_TYPE_LABEL[ASSISTANT]).toBe('Súper');
  });

  it('solo ve Cargar jugada, Administrar jugadas y Configuración', () => {
    expect(pagesOf(ASSISTANT)).toEqual(['MAKE_BET', 'MANAGE_BETS', 'SETTINGS', 'CHANGE_PASSWORD']);
  });

  it('entra a Cargar jugada, no a Jugadas', () => {
    expect(pollaHomePage(ASSISTANT)).toBe('MAKE_BET');
  });

  it('la API le niega Jugadas, Revisar ticket, Ventas y Resultados', () => {
    for (const roles of Object.values(POLLA_API_ROLES)) {
      expect(roles).not.toContain(ASSISTANT);
    }
  });
});

describe('los demás roles no cambian', () => {
  it('superadmin+ ve todo menos Organizaciones (solo el dueño)', () => {
    const allButOrganizations = PAGES.filter((page) => page !== 'ORGANIZATIONS');
    expect(pagesOf(OWNER)).toEqual(PAGES);
    expect(pagesOf(CAPITALIST)).toEqual(allButOrganizations);
    expect(pagesOf(SUPERADMIN)).toEqual(allButOrganizations);
  });

  it('el admin de grupo: operación de su grupo, sin cuenta corriente ni configuración de la organización', () => {
    expect(pagesOf(ADMIN)).toEqual([
      'BETS',
      'MAKE_BET',
      'MANAGE_BETS',
      'CHECK_TICKET',
      'SALES',
      'RESULTS',
      'USERS',
      'SETTINGS',
      'CHANGE_PASSWORD',
    ]);
  });

  it('el pasador, además, su cuenta corriente', () => {
    expect(pagesOf(CASHIER)).toEqual([
      'BETS',
      'MAKE_BET',
      'MANAGE_BETS',
      'CHECK_TICKET',
      'SALES',
      'RESULTS',
      'USERS',
      'CURRENT_ACCOUNT',
      'SETTINGS',
      'CHANGE_PASSWORD',
    ]);
  });

  it('el jugador: sus jugadas, cargar y resultados', () => {
    expect(pagesOf(PLAYER)).toEqual(['BETS', 'MAKE_BET', 'RESULTS', 'SETTINGS', 'CHANGE_PASSWORD']);
  });

  it('todos menos el Súper entran a Jugadas', () => {
    for (const role of [OWNER, CAPITALIST, SUPERADMIN, ADMIN, CASHIER, PLAYER]) {
      expect(pollaHomePage(role)).toBe('BETS');
    }
  });

  it('sin rol no ve nada', () => {
    expect(PAGES.filter((page) => canSeePollaPage(null, page))).toEqual([]);
  });
});
