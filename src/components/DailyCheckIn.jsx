import { useState } from 'react'

export default function DailyCheckIn({ onSubmit }) {
  const [formData, setFormData] = useState({
    energy: 3,
    stress: 3,
    mood: 3,
    sleep_quality: 3,
    caffeine_amount: '',
    caffeine_latest_time: '',
    screen_minutes_after_9pm: '',
    relational_load: 3,
    symptoms: '',
    strength_training_done: false,
    notes: ''
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      date: new Date().toISOString().split('T')[0],
      type: 'manual_checkin'
    })
  }

  const SliderField = ({ label, name, value }) => (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <label className="text-xs text-slate-ui font-medium uppercase tracking-wider">{label}</label>
        <span className="text-jade font-mono text-sm">{value}/5</span>
      </div>
      <input
        type="range"
        name={name}
        min="1"
        max="5"
        value={value}
        onChange={handleChange}
        className="w-full accent-jade bg-ink h-1.5 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  )

  return (
    <div className="bg-ink-soft border border-slate-border rounded-2xl p-6 space-y-6 animate-slide-up">
      <div className="space-y-1">
        <h3 className="font-display font-semibold text-white text-base">Daily Check-in</h3>
        <p className="text-slate-ui text-xs">Log your manual context for today</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <SliderField label="Energy Level" name="energy" value={formData.energy} />
          <SliderField label="Stress Level" name="stress" value={formData.stress} />
          <SliderField label="Mood" name="mood" value={formData.mood} />
          <SliderField label="Sleep Quality" name="sleep_quality" value={formData.sleep_quality} />
          <SliderField label="Relational Load" name="relational_load" value={formData.relational_load} />

          <div className="space-y-1.5">
            <label className="text-xs text-slate-ui font-medium uppercase tracking-wider">Strength Training</label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                name="strength_training_done"
                checked={formData.strength_training_done}
                onChange={handleChange}
                className="w-5 h-5 rounded border-slate-border bg-ink text-jade focus:ring-jade/20"
              />
              <span className="text-sm text-slate-ui group-hover:text-white transition-colors">Done today?</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-ui font-medium uppercase tracking-wider">Caffeine Amount</label>
            <input
              type="text"
              name="caffeine_amount"
              value={formData.caffeine_amount}
              onChange={handleChange}
              placeholder="e.g. 2 coffees"
              className="w-full bg-ink border border-slate-border focus:border-jade/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-ui font-medium uppercase tracking-wider">Latest Caffeine</label>
            <input
              type="time"
              name="caffeine_latest_time"
              value={formData.caffeine_latest_time}
              onChange={handleChange}
              className="w-full bg-ink border border-slate-border focus:border-jade/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-ui font-medium uppercase tracking-wider">Symptoms / Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Any symptoms, headaches, or general notes..."
            rows="3"
            className="w-full bg-ink border border-slate-border focus:border-jade/60 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors resize-none"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-jade hover:bg-jade-dark text-ink-DEFAULT font-display font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-jade/20"
        >
          Save Check-in →
        </button>
      </form>
    </div>
  )
}
