import React, { useEffect, useState } from "react";
import * as monaco from "monaco-editor";

interface TeacherCursorProps {
  editor: monaco.editor.IStandaloneCodeEditor;
  position: { lineNumber: number; column: number; teacherName: string };
}

const TeacherCursor: React.FC<TeacherCursorProps> = ({ editor, position }) => {
  const [cursorStyle, setCursorStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const updateCursorPosition = () => {
      try {
        const pixelPosition = editor.getScrolledVisiblePosition({
          lineNumber: position.lineNumber,
          column: position.column
        });
        if (pixelPosition) {
          const editorContainer = editor.getDomNode();
          if (editorContainer) {
            setCursorStyle({
              position: 'absolute',
              left: `${pixelPosition.left}px`,
              top: `${pixelPosition.top}px`,
              zIndex: 1000,
              pointerEvents: 'none'
            });
          }
        }
      } catch (error) {
        console.error('Error updating teacher cursor position:', error);
      }
    };
    updateCursorPosition();
    const scrollDisposable = editor.onDidScrollChange(updateCursorPosition);
    const layoutDisposable = editor.onDidLayoutChange(updateCursorPosition);
    return () => {
      scrollDisposable.dispose();
      layoutDisposable.dispose();
    };
  }, [editor, position]);

  return (
    <div style={cursorStyle}>
      <div className="teacher-cursor">
        <div className="teacher-cursor-label">
          {position.teacherName}
        </div>
      </div>
    </div>
  );
};

export default TeacherCursor;
