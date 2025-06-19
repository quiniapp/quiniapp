import { USER_TYPE } from 'helper/types/user.type';


interface IsRoleCashierProps {
  role: USER_TYPE | null
  children?: React.ReactNode
}

const IsRoleCashier = ({role, children}: IsRoleCashierProps) => {
  if(role === USER_TYPE.CASHIER){
    return false;
  }
  return (
    <>
      {children}
    </>
  )
}

export default IsRoleCashier;