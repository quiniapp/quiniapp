import { supabase } from '../../database/db.connection.js';
import bcrypt from 'bcrypt';

/**
 * Limpia todas las tablas relevantes para los tests
 */
export async function cleanTestDatabase() {
  const tables = [
    'current_accounts',
    'ticket_prices_by_turn',
    'results',
    'bets',
    'tickets',
    'schedule_lotteries',
    'schedules',
    'lotteries',
    'users',
    'organizations',
  ];

  for (const table of tables) {
    // Usar gte (greater than or equal) con una fecha muy antigua para match all
    const { error } = await supabase.from(table).delete().gte('created_at', '1970-01-01');

    if (
      error &&
      !error.message.includes('does not exist') &&
      !error.message.includes('column "created_at" does not exist')
    ) {
      console.warn(`Warning cleaning ${table}:`, error.message);
    }
  }
}

/**
 * Crea la organización de prueba
 */
export async function createTestOrganization(orgId: string, name: string) {
  const { data, error } = await supabase
    .from('organizations')
    .insert({
      organization_id: orgId,
      name,
    })
    .select()
    .single();

  if (error) throw new Error(`Error creando organización: ${error.message}`);
  return data;
}

/**
 * Crea usuarios de prueba (owner + cashiers)
 */
export async function createTestUsers(users: any[]) {
  for (const user of users) {
    // Hashear password antes de insertar
    const passwordHash = await bcrypt.hash(user.password, 10);

    const { error } = await supabase.from('users').insert({
      user_id: user.user_id,
      organization_id: user.organization_id,
      user_type: user.user_type,
      cashier_type: user.cashier_type,
      name: user.name,
      username: user.username,
      password_hash: passwordHash,
      number: user.number,
      fee: user.fee,
      fee_plus: user.fee_plus,
      disabled: user.disabled,
    });

    if (error) throw new Error(`Error creando usuario ${user.username}: ${error.message}`);
  }
}

/**
 * Crea schedules de prueba
 */
export async function createTestSchedules(schedules: any[]) {
  const { error } = await supabase.from('schedules').insert(schedules);
  if (error) throw new Error(`Error creando schedules: ${error.message}`);
}

/**
 * Crea lotteries de prueba
 */
export async function createTestLotteries(lotteries: any[]) {
  const { error } = await supabase.from('lotteries').insert(lotteries);
  if (error) throw new Error(`Error creando lotteries: ${error.message}`);
}

/**
 * Crea schedule_lotteries (relación many-to-many)
 */
export async function createTestScheduleLotteries(scheduleLotteries: any[]) {
  const { error } = await supabase.from('schedule_lotteries').insert(scheduleLotteries);
  if (error) throw new Error(`Error creando schedule_lotteries: ${error.message}`);
}

/**
 * Crea tickets de prueba
 */
export async function createTestTickets(tickets: any[]) {
  const { error } = await supabase.from('tickets').insert(tickets);
  if (error) throw new Error(`Error creando tickets: ${error.message}`);
}

/**
 * Crea bets de prueba
 */
export async function createTestBets(bets: any[]) {
  const { error } = await supabase.from('bets').insert(bets);
  if (error) throw new Error(`Error creando bets: ${error.message}`);
}

/**
 * Crea results de prueba
 */
export async function createTestResults(results: any[]) {
  for (const result of results) {
    const { error } = await supabase.from('results').insert(result);
    if (error) throw new Error(`Error creando result: ${error.message}`);
  }
}
