import React, { useState, useEffect } from 'react'
import './SnowEffect.css'

const API_URL = 'https://api.open-meteo.com/v1/forecast?latitude=40.7738&longitude=30.3801&daily=apparent_temperature_mean&forecast_days=1'

function SnowEffect() {
  const [snowflakeCount, setSnowflakeCount] = useState(0)

  useEffect(() => {
    const fetchTemperature = async () => {
      try {
        // Bugünün tarihini ISO formatında al (YYYY-MM-DD)
        const today = new Date().toISOString().split('T')[0]
        const storageKey = `snow_temperature_${today}`
        
        // localStorage'dan bugünün sıcaklığını kontrol et
        const storedTemperature = localStorage.getItem(storageKey)
        
        let temperature
        
        if (storedTemperature) {
          // Eğer localStorage'da varsa, oradan al
          temperature = parseFloat(storedTemperature)
        } else {
          // Yoksa API'den al
          const response = await fetch(API_URL)
          const data = await response.json()
          
          // API'den gelen ortalama sıcaklığı al
          if (data.daily && data.daily.apparent_temperature_mean && data.daily.apparent_temperature_mean.length > 0) {
            temperature = data.daily.apparent_temperature_mean[0]
            
            // localStorage'a kaydet
            localStorage.setItem(storageKey, temperature.toString())
          } else {
            // API'den veri alınamazsa, kar tanesi gösterme
            setSnowflakeCount(0)
            return
          }
        }
        
        // Sıcaklığa göre kar tanesi sayısını belirle
        if (temperature <= 0) {
          setSnowflakeCount(100)
        } else if (temperature <= 5) {
          setSnowflakeCount(50)
        } else if (temperature <= 10) {
          setSnowflakeCount(25)
        } else {
          setSnowflakeCount(0)
        }
      } catch (error) {
        console.error('Sıcaklık bilgisi alınamadı:', error)
        // Hata durumunda kar tanesi gösterme
        setSnowflakeCount(0)
      }
    }

    fetchTemperature()
  }, [])

  // Kar tanesi sayısı 0 ise hiçbir şey render etme
  if (snowflakeCount === 0) {
    return null
  }

  // Create snowflakes based on temperature
  const snowflakes = Array.from({ length: snowflakeCount }, (_, i) => i)

  return (
    <div className="snow-container">
      {snowflakes.map((flake) => {
        // Random delay so snowflakes start at different times (0-15 seconds)
        const delay = Math.random() * 15
        return (
          <div
            key={flake}
            className="snowflake"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${10 + Math.random() * 10}s`,
              opacity: 0.3 + Math.random() * 0.7,
              transform: `scale(${0.5 + Math.random() * 0.5})`
            }}
          >
            ❄
          </div>
        )
      })}
    </div>
  )
}

export default SnowEffect
