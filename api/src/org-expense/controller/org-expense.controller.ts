import { IOrgExpense, OrgExpenseRepository } from '../repository/org-expense.repository';

export class OrgExpenseController {
  private repository = new OrgExpenseRepository();

  getByOrgAndDate = async (
    organization_id: string,
    date: string,
    group_id?: string | null
  ): Promise<IOrgExpense[]> => {
    try {
      return await this.repository.getByOrgAndDate(organization_id, date, group_id);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  create = async (
    organization_id: string,
    date: string,
    name: string,
    amount: number,
    group_id?: string | null
  ): Promise<IOrgExpense> => {
    try {
      return await this.repository.create(organization_id, date, name, amount, group_id);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  delete = async (expense_id: string, organization_id: string): Promise<void> => {
    try {
      await this.repository.delete(expense_id, organization_id);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
