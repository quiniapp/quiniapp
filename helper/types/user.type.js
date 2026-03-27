/* eslint-disable no-unused-vars */
// User hierarchy: OWNER -> CAPITALIST -> SUPERADMIN -> ADMIN -> CASHIER
export var USER_TYPE;
(function (USER_TYPE) {
    USER_TYPE["OWNER"] = "OWNER";
    USER_TYPE["CAPITALIST"] = "CAPITALIST";
    USER_TYPE["SUPERADMIN"] = "SUPERADMIN";
    USER_TYPE["ADMIN"] = "ADMIN";
    USER_TYPE["CASHIER"] = "CASHIER";
})(USER_TYPE || (USER_TYPE = {}));
export var CASHIER_TYPE;
(function (CASHIER_TYPE) {
    CASHIER_TYPE["PC"] = "PC";
    CASHIER_TYPE["STREET"] = "STREET";
})(CASHIER_TYPE || (CASHIER_TYPE = {}));
