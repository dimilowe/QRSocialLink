import type { ReactNode } from "react";
export function useAuth(){return {user:null as {id:string;username:string;avatarUrl?:string}|null};}
export function Link({children,href,...props}:{children:ReactNode;href:string;[key:string]:unknown}){return <a href={href} {...props}>{children}</a>;}
export function useLocation(){return ["/"] as const;}
