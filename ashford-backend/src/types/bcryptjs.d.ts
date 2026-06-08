declare module "bcryptjs" {
  export function hash(plain: string, saltRounds: number): Promise<string>;
  export function compare(plain: string, hash: string): Promise<boolean>;
  const bcrypt: {
    hash: typeof hash;
    compare: typeof compare;
  };
  export default bcrypt;
}
