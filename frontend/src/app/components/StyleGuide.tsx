export function StyleGuide() {
  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <h1 className="text-[#e2b714] mb-8">OpenContest Design System</h1>

      {/* Color Palette */}
      <section className="mb-12">
        <h2 className="text-[#d1d0c5] mb-6">Color Palette</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="border border-[#646669] rounded p-4">
            <div className="w-full h-20 bg-[#323437] border border-[#646669] rounded mb-2" />
            <div className="text-sm text-[#d1d0c5]">Background</div>
            <div className="text-xs text-[#646669]">#323437</div>
          </div>
          <div className="border border-[#646669] rounded p-4">
            <div className="w-full h-20 bg-[#e2b714] border border-[#646669] rounded mb-2" />
            <div className="text-sm text-[#d1d0c5]">Primary/Accent</div>
            <div className="text-xs text-[#646669]">#e2b714</div>
          </div>
          <div className="border border-[#646669] rounded p-4">
            <div className="w-full h-20 bg-[#d1d0c5] border border-[#646669] rounded mb-2" />
            <div className="text-sm text-[#d1d0c5]">Text</div>
            <div className="text-xs text-[#646669]">#d1d0c5</div>
          </div>
          <div className="border border-[#646669] rounded p-4">
            <div className="w-full h-20 bg-[#646669] border border-[#646669] rounded mb-2" />
            <div className="text-sm text-[#d1d0c5]">Subtext</div>
            <div className="text-xs text-[#646669]">#646669</div>
          </div>
          <div className="border border-[#646669] rounded p-4">
            <div className="w-full h-20 bg-[#879f27] border border-[#646669] rounded mb-2" />
            <div className="text-sm text-[#d1d0c5]">Success</div>
            <div className="text-xs text-[#646669]">#879f27</div>
          </div>
          <div className="border border-[#646669] rounded p-4">
            <div className="w-full h-20 bg-[#ca4754] border border-[#646669] rounded mb-2" />
            <div className="text-sm text-[#d1d0c5]">Error</div>
            <div className="text-xs text-[#646669]">#ca4754</div>
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className="mb-12">
        <h2 className="text-[#d1d0c5] mb-6">Typography</h2>
        <div className="space-y-4 border border-[#646669] rounded p-6">
          <div>
            <h1 className="text-[#d1d0c5]">Heading 1 - JetBrains Mono</h1>
            <div className="text-xs text-[#646669] mt-1">2rem / 32px, medium weight</div>
          </div>
          <div>
            <h2 className="text-[#d1d0c5]">Heading 2 - JetBrains Mono</h2>
            <div className="text-xs text-[#646669] mt-1">1.5rem / 24px, medium weight</div>
          </div>
          <div>
            <h3 className="text-[#d1d0c5]">Heading 3 - JetBrains Mono</h3>
            <div className="text-xs text-[#646669] mt-1">1.25rem / 20px, medium weight</div>
          </div>
          <div>
            <p className="text-[#d1d0c5]">Body text - JetBrains Mono Regular</p>
            <div className="text-xs text-[#646669] mt-1">1rem / 16px, normal weight</div>
          </div>
          <div>
            <code className="text-[#e2b714]">Code inline - monospace</code>
            <div className="text-xs text-[#646669] mt-1">1rem / 16px, yellow accent</div>
          </div>
        </div>
      </section>

      {/* Buttons */}
      <section className="mb-12">
        <h2 className="text-[#d1d0c5] mb-6">Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <button className="px-4 py-2 bg-[#e2b714] text-[#323437] rounded hover:bg-[#d1a613] transition-colors">
            Primary Button
          </button>
          <button className="px-4 py-2 border border-[#646669] rounded text-[#646669] hover:border-[#e2b714] hover:text-[#e2b714] transition-colors">
            Secondary Button
          </button>
          <button className="px-4 py-2 text-[#d1d0c5] hover:text-[#e2b714] transition-colors">
            Text Button
          </button>
          <button className="px-4 py-2 text-[#d1d0c5] hover:underline">Text with Underline</button>
        </div>
      </section>

      {/* UI Elements */}
      <section className="mb-12">
        <h2 className="text-[#d1d0c5] mb-6">UI Elements</h2>
        <div className="space-y-6">
          {/* Cards */}
          <div>
            <h3 className="text-[#e2b714] mb-3">Cards</h3>
            <div className="border border-[#646669] rounded p-6 hover:border-[#e2b714] transition-colors">
              <div className="text-[#d1d0c5] mb-2">Card Title</div>
              <div className="text-[#646669] text-sm">
                1px solid border, 4px border-radius, hover effect
              </div>
            </div>
          </div>

          {/* Input */}
          <div>
            <h3 className="text-[#e2b714] mb-3">Input Fields</h3>
            <input
              type="text"
              placeholder="Search..."
              className="w-full max-w-md bg-transparent border border-[#646669] rounded px-3 py-2 text-[#d1d0c5] placeholder-[#646669] focus:outline-none focus:border-[#e2b714]"
            />
          </div>

          {/* Badges */}
          <div>
            <h3 className="text-[#e2b714] mb-3">Badges</h3>
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1 text-xs border border-[#879f27] text-[#879f27] rounded">
                Success
              </span>
              <span className="px-3 py-1 text-xs border border-[#e2b714] text-[#e2b714] rounded">
                Warning
              </span>
              <span className="px-3 py-1 text-xs border border-[#ca4754] text-[#ca4754] rounded">
                Error
              </span>
              <span className="px-3 py-1 text-xs border border-[#646669] text-[#646669] rounded">
                Neutral
              </span>
            </div>
          </div>

          {/* Code Block */}
          <div>
            <h3 className="text-[#e2b714] mb-3">Code Block</h3>
            <div className="bg-[#2c2e31] border border-[#646669] rounded p-4">
              <pre className="text-[#d1d0c5] text-sm">
                {`#include <iostream>
using namespace std;

int main() {
    cout << "Hello, OpenContest!" << endl;
    return 0;
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Design Principles */}
      <section>
        <h2 className="text-[#d1d0c5] mb-6">Design Principles</h2>
        <div className="border border-[#646669] rounded p-6 space-y-4 text-[#646669]">
          <div>
            <span className="text-[#e2b714]">→</span> Minimalist: No shadows, no gradients, clean
            borders
          </div>
          <div>
            <span className="text-[#e2b714]">→</span> Terminal-like: Monospace fonts only,
            code-focused aesthetic
          </div>
          <div>
            <span className="text-[#e2b714]">→</span> Typography hierarchy: Use font weight and size
            instead of colors
          </div>
          <div>
            <span className="text-[#e2b714]">→</span> Consistent spacing: Generous whitespace for
            breathability
          </div>
          <div>
            <span className="text-[#e2b714]">→</span> 1px borders, 4px border-radius everywhere
          </div>
          <div>
            <span className="text-[#e2b714]">→</span> Hover effects: Subtle color transitions, no
            dramatic changes
          </div>
        </div>
      </section>
    </div>
  );
}
