import React, { useState } from 'react';

const TaskList = ({ tasks = [], onAddTask, onUpdateTask, onDeleteTask, position = 'left', userName, readOnly = false }) => {
  const [newTaskText, setNewTaskText] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  const handleAddTask = () => {
    if (newTaskText.trim() && !readOnly) {
      onAddTask(newTaskText.trim());
      setNewTaskText('');
      setIsAddingTask(false);
    }
  };

  const handleToggleTask = (taskId, currentCompleted) => {
    if (!readOnly) {
      onUpdateTask(taskId, { completed: !currentCompleted });
    }
  };

  const handleDeleteTask = (taskId) => {
    if (!readOnly) {
      onDeleteTask(taskId);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddTask();
    } else if (e.key === 'Escape') {
      setIsAddingTask(false);
      setNewTaskText('');
    }
  };

  return (
    <div className={`task-list ${position}`}>
      <div className="task-list-header">
        <h3>{userName}'s Tasks</h3>
        {!readOnly && (
          <button 
            className="add-task-btn"
            onClick={() => setIsAddingTask(true)}
            disabled={isAddingTask}
          >
            + Add Task
          </button>
        )}
      </div>

      <div className="task-list-content">
        {!readOnly && isAddingTask && (
          <div className="task-input-container">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter task..."
              className="task-input"
              autoFocus
            />
            <div className="task-input-actions">
              <button onClick={handleAddTask} className="save-task-btn">
                Save
              </button>
              <button 
                onClick={() => {
                  setIsAddingTask(false);
                  setNewTaskText('');
                }} 
                className="cancel-task-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="tasks-container">
          {tasks.length === 0 ? (
            <div className="no-tasks">
              <p>{readOnly ? 'No tasks yet.' : 'No tasks yet. Add one to get started!'}</p>
            </div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                <div 
                  className="task-content"
                  onClick={() => handleToggleTask(task.id, task.completed)}
                  style={{ cursor: readOnly ? 'default' : 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => handleToggleTask(task.id, task.completed)}
                    className="task-checkbox"
                    disabled={readOnly}
                  />
                  <span className="task-text">{task.text}</span>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="delete-task-btn"
                    title="Delete task"
                  >
                    ×
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="task-stats">
          <span className="completed-count">
            {tasks.filter(task => task.completed).length} of {tasks.length} completed
          </span>
        </div>
      </div>
    </div>
  );
};

export default TaskList; 