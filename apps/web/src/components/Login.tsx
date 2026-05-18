
export const Login = ({ onLogin }: { onLogin: () => void }) => {
  return (
    <div className="bg-surface-container border border-outline-variant p-8 shadow-2xl relative">
      <div className="mb-8 space-y-2">
        <h1 className="font-display-lg text-display-lg text-on-surface">Institutional Login</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Access your high-performance trading gateway.</p>
      </div>
      <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
        <div className="space-y-2">
          <label className="font-label-caps text-label-caps text-on-surface-variant" htmlFor="email">EMAIL ADDRESS</label>
          <div className="relative group">
            <input className="w-full bg-surface-container-lowest border border-outline-variant px-4 py-3 text-on-surface font-body-md focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all" id="email" placeholder="name@firm.com" type="email"/>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="font-label-caps text-label-caps text-on-surface-variant" htmlFor="password">PASSWORD</label>
            <a className="font-label-caps text-label-caps text-primary hover:text-primary-fixed transition-colors" href="#">FORGOT PASSWORD?</a>
          </div>
          <div className="relative group">
            <input className="w-full bg-surface-container-lowest border border-outline-variant px-4 py-3 text-on-surface font-body-md focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all" id="password" placeholder="••••••••" type="password"/>
          </div>
        </div>
        <div className="flex items-center gap-2 py-2">
          <input className="w-4 h-4 rounded-none bg-surface-container-lowest border-outline-variant text-primary-container focus:ring-offset-background" id="remember" type="checkbox"/>
          <label className="font-body-sm text-body-sm text-on-surface-variant select-none" htmlFor="remember">Remember this device for 30 days</label>
        </div>
        <button className="w-full bg-primary-container text-on-primary-container font-title-sm text-title-sm py-4 uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all" type="submit">
          Sign In
        </button>
      </form>
    </div>
  );
};
