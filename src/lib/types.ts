export type Profile = {id:string;email:string;full_name:string;role:'admin'|'manager'|'member'};
export type Area = {id:string;name:string;description:string|null;color_code:string};
export type Item = {id:string;note_id:string|null;area_id:string;title:string;description:string|null;type:'task'|'info';assigned_to:string|null;created_by:string;created_at:string;due_date:string|null;completed_at:string|null;status:'pending_approval'|'todo'|'in_progress'|'done'|'archived';approved_at:string|null};
export type Note = {id:string;title:string;source_type:'image'|'pdf'|'docx'|'manual';file_url:string|null;created_by:string;created_at:string;meeting_key:string|null;processing_state:string;approved_at:string|null;manual_text:string|null};
export type Candidate = {title:string;description:string;type:'task'|'info';area_id:string;assigned_to:string|null;due_date:string|null;duplicate_id:string|null;duplicate_reason:string|null};
