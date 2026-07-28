/**
 * Simple XER Parser for Primavera P6 files
 * Parses tab-separated P6 export files into a structured JSON object
 */
export function parseXER(content) {
  const lines = content.split(/\r?\n/);
  const tables = {};
  let currentTable = null;
  let currentFields = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split('\t');
    const type = parts[0];
    const values = parts.slice(1);

    if (type === '%T') {
      currentTable = values[0];
      tables[currentTable] = [];
      currentFields = [];
    } else if (type === '%F') {
      currentFields = values;
    } else if (type === '%R' && currentTable) {
      const record = {};
      currentFields.forEach((field, index) => {
        record[field] = values[index] || '';
      });
      tables[currentTable].push(record);
    }
  }

  return tables;
}

/**
 * Transforms parsed XER tables into Milestones and Tasks
 * @param {Object} tables Parsed XER tables
 * @returns {Array} List of milestones with nested tasks
 */
export function transformXERToMilestones(tables) {
  const wbsList = tables['PROJWBS'] || [];
  const taskList = tables['TASK'] || [];

  // 1. Find the root WBS (usually proj_node_flag = 'Y')
  const rootWBS = wbsList.find(w => w.proj_node_flag === 'Y');
  if (!rootWBS) return [];

  // 2. Identify top-level WBS elements (children of root) as Milestones
  // Or if the file has a flat structure, use all non-root WBS
  const milestones = wbsList.filter(w => w.parent_wbs_id === rootWBS.wbs_id);

  // If no children found, maybe the structure is different. 
  // Let's fallback to all WBS except root if needed, but for EC00515, children of root are Milestones.
  
  return milestones.map(wbs => {
    // Get all tasks for this WBS (including sub-WBS tasks if we want to flatten)
    // For simplicity, let's just get tasks directly in this WBS
    const subWbsIds = [wbs.wbs_id];
    
    // Find sub-WBS nodes
    const findChildren = (parentId) => {
      wbsList.forEach(w => {
        if (w.parent_wbs_id === parentId) {
          subWbsIds.push(w.wbs_id);
          findChildren(w.wbs_id);
        }
      });
    };
    findChildren(wbs.wbs_id);

    const tasks = taskList
      .filter(task => subWbsIds.includes(task.wbs_id))
      .map(task => ({
        title: task.task_name,
        description: `Task Code: ${task.task_code}`,
        isCompleted: task.status_code === 'TK_Complete',
        startDate: task.early_start_date ? new Date(task.early_start_date.replace(/-/g, '/')) : null,
        endDate: task.early_end_date ? new Date(task.early_end_date.replace(/-/g, '/')) : null,
        status: mapTaskStatus(task.status_code)
      }));

    return {
      name: wbs.wbs_name,
      description: `WBS Code: ${wbs.wbs_short_name}`,
      tasks: tasks,
      status: 'Pending' // Initial status
    };
  });
}

function mapTaskStatus(p6Status) {
  switch (p6Status) {
    case 'TK_Complete': return 'Completed';
    case 'TK_Active': return 'In Progress';
    case 'TK_NotStart': return 'Pending';
    default: return 'Pending';
  }
}
