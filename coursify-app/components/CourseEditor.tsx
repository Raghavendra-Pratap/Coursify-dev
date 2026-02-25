'use client'

import { useState } from 'react'
import type { Course, Module, Lesson } from '@/lib/types'
import { ModuleEditor } from './ModuleEditor'
import { createClient } from '@/lib/supabase-client'

interface CourseEditorProps {
  course: Course
  modules: Module[]
}

export function CourseEditor({ course, modules: initialModules }: CourseEditorProps) {
  const [modules, setModules] = useState(initialModules)
  const [selectedModule, setSelectedModule] = useState<string | null>(null)
  const supabase = createClient()

  const handleAddModule = async () => {
    const moduleTitle = prompt('Enter module title:')
    if (!moduleTitle) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const maxOrder = modules.length > 0 
        ? Math.max(...modules.map(m => m.order_index))
        : -1

      const { data, error } = await supabase
        .from('modules')
        .insert({
          course_id: course.id,
          title: moduleTitle,
          order_index: maxOrder + 1,
        })
        .select()
        .single()

      if (error) throw error
      if (data) {
        setModules([...modules, data])
        setSelectedModule(data.id)
      }
    } catch (err) {
      console.error('Error adding module:', err)
      alert('Failed to add module')
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Module List */}
      <div className="col-span-1 bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Modules</h2>
          <button
            onClick={handleAddModule}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => setSelectedModule(module.id)}
              className={`w-full text-left px-3 py-2 rounded ${
                selectedModule === module.id
                  ? 'bg-blue-100 border border-blue-300'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              {module.title}
            </button>
          ))}
        </div>
      </div>

      {/* Module Editor */}
      <div className="col-span-2">
        {selectedModule ? (
          <ModuleEditor
            module={modules.find(m => m.id === selectedModule)!}
            courseId={course.id}
          />
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Select a module to edit, or create a new one
          </div>
        )}
      </div>
    </div>
  )
}
