import {ChevronRight, type LucideIcon} from 'lucide-react';
import {AdvancedAppLinks} from './workspace-design';

type Destination = {id:string; label:string; icon:LucideIcon; description?:string};
type Group = {label:string; destinations:Destination[]};

export function WorkspaceMore({space, groups, allowed, onNavigate}:{
  space:'Trip'|'Money';
  groups:Group[];
  allowed:string[];
  onNavigate:(destination:string)=>void;
}){
  return <section className="money-more panel">
    <h2>More</h2>
    <nav aria-label={`More ${space} pages`}>
      {groups.map(group=>{
        const destinations=group.destinations.filter(destination=>allowed.includes(destination.id));
        if(!destinations.length)return null;
        return <div className="workspace-more-group" key={group.label}>
          <h3>{group.label}</h3>
          {destinations.map(({id,label,icon:Icon,description})=><button className="workspace-more-row" type="button" key={id} onClick={()=>onNavigate(id)}>
            <Icon size={20} aria-hidden="true"/>
            <span>{label}{description&&<small>{description}</small>}</span>
            <ChevronRight size={16} aria-hidden="true"/>
          </button>)}
        </div>;
      })}
    </nav>
    <AdvancedAppLinks/>
  </section>;
}
