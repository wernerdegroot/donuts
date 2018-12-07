export type Hkts<A> = {
  option: Option<A>;
  promise: Promise<A>;
};

export type Monad<HktToken extends keyof Hkts<any>> = {
  flatMap<A, B>(
    o: Hkts<A>[HktToken],
    fn: (a: A) => Hkts<B>[HktToken]
  ): Hkts<B>[HktToken];

  pure<A>(a: A): Hkts<A>[HktToken];
};

export type Option<A> = A | false;

export function some<A>(a: A): Option<A> {
  return a;
}

export type None = false;

export const none: None = false;

export const optionMonad: Monad<"option"> = {
  flatMap<A, B>(opt: Option<A>, fn: (a: A) => Option<B>): Option<B> {
    if (opt === false) {
      return false;
    } else {
      return fn(opt);
    }
  },
  pure<A>(a: A) {
    return a;
  }
};

export const promiseMonad: Monad<"promise"> = {
  flatMap<A, B>(opt: Promise<A>, fn: (a: A) => Promise<B>): Promise<B> {
    return opt.then(fn);
  },
  pure<A>(a: A) {
    return Promise.resolve(a);
  }
};

export declare function doTheThing<HktToken extends keyof Hkts<any>, A>(
  monad: Monad<HktToken>,
  fn: () => IterableIterator<Hkts<any>[HktToken]>
): () => Hkts<A>[HktToken];
