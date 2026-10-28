// Start the URL-selected group before awaiting the directory. Capture rejection
// immediately, even if directory validation later discards this speculative read.
export function primeGroupRequest<T>(group:string,read:(id:string)=>Promise<T>){
 return group?read(group).then(response=>({response,error:null}),error=>({response:null,error})):null;
}
